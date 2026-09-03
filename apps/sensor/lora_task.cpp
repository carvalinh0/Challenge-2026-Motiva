// GODMODE libera acesso a métodos internos do RadioLib normalmente privados/
// protected (só nesta translation unit — não muda o layout binário das
// classes, só o que o compilador permite chamar daqui). Precisamos disso
// especificamente por causa de radio.getMod()->init(): é o único jeito de
// chamar a inicialização REAL do SPI (a mesma que radio.begin() usaria) sem
// passar pelo resto do begin() que limpa o IRQ do chip (ver
// loraTaskDrainPendingWakePacket logo abaixo). Uma reimplementação manual
// daquele init (SPI.begin() + pinMode/digitalWrite do CS, tentada antes) não
// é suficiente — na prática devolveu leitura de lixo (flags de IRQ com bits
// reservados setados, tamanho de pacote absurdo), então usar a função de
// verdade da lib é mais seguro que replicar às cegas.
#define RADIOLIB_GODMODE 1

#include "lora_task.h"
#include "config.h"
#include "rtc_state.h"
#include <esp_sleep.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>
#include <freertos/semphr.h>

namespace {

SX1262* s_radio = nullptr;
TaskHandle_t s_taskHandle = nullptr;
QueueHandle_t s_rxQueue = nullptr;         // MeshPacket endereçados a este nó, prontos pro core principal ler

// Cada pacote enfileirado para transmissão leva um número de ordem. Antes
// isto era um semáforo binário liberado depois de QUALQUER transmissão, e
// quem chamava loraTaskSendAndWait() não tinha como saber se o que saiu foi o
// SEU pacote ou um relay que estava na frente da fila: bastava um relay ter
// transmitido antes para o semáforo já estar disponível, a função voltar true
// na hora e o nó entrar em deep sleep com o próprio pacote ainda enfileirado.
// Como as seq são atribuídas na mesma ordem da fila, "minha seq já foi
// transmitida" é uma resposta exata.
struct OutgoingPacket {
  MeshPacket packet;
  uint32_t seq;
};

// As duas seq são lidas de um núcleo e escritas do outro. Não precisam de
// lock: são uint32_t alinhados, e leitura/escrita de 32 bits alinhados é
// atômica no Xtensa (nunca se lê metade de um valor). O volatile está aí só
// para o compilador não guardar o valor num registrador dentro dos laços de
// espera abaixo — sem ele, loraTaskSendAndWait() giraria para sempre lendo uma
// cópia velha.
QueueHandle_t s_txQueue = nullptr;          // OutgoingPacket pendentes de transmissão
SemaphoreHandle_t s_txMutex = nullptr;      // serializa "tira uma seq + enfileira"
volatile uint32_t s_txLastQueuedSeq = 0;    // última seq entregue à fila
volatile uint32_t s_txLastSentSeq = 0;      // última seq que realmente saiu pelo rádio

volatile bool s_packetReceivedFlag = false;

// Comparação à prova de wraparound do contador de 32 bits: olha a DIFERENÇA
// com sinal, não os valores absolutos.
bool txSeqAlreadySent(uint32_t seq) {
  return (int32_t)(s_txLastSentSeq - seq) >= 0;
}

// Enfileira para transmissão e devolve em outSeq o número de ordem do pacote.
//
// O mutex cobre a atribuição da seq E o xQueueSend porque há DOIS produtores
// em núcleos diferentes: o core principal (respostas deste nó) e a própria
// task de LoRa (relay). Sem ele, duas seq podiam ser emitidas numa ordem e os
// pacotes entrarem na fila na ordem inversa — e aí "a seq 5 já saiu" viraria
// mentira para quem esperava por ela. A seção crítica é curta (um xQueueSend
// sem bloqueio), então a espera é de microssegundos.
bool enqueueForTx(const MeshPacket& packet, uint32_t* outSeq) {
  if (!s_txQueue || !s_txMutex) return false;
  if (xSemaphoreTake(s_txMutex, pdMS_TO_TICKS(50)) != pdTRUE) return false;

  OutgoingPacket outgoing;
  outgoing.packet = packet;
  outgoing.seq = s_txLastQueuedSeq + 1;

  bool queued = (xQueueSend(s_txQueue, &outgoing, 0) == pdTRUE);
  if (queued) {
    s_txLastQueuedSeq = outgoing.seq;
    if (outSeq) *outSeq = outgoing.seq;
  }

  xSemaphoreGive(s_txMutex);
  return queued;
}

// ISR: só marca a flag. Nada de I2C/Serial/alocação aqui dentro.
void IRAM_ATTR onRadioIrq() {
  s_packetReceivedFlag = true;
}

void handleIncomingPacket() {
  // Diagnostico: readData() já limpa os flags de IRQ internamente (chama
  // clearIrqStatus() antes de retornar, mesmo em erro), então captura ANTES
  // de chamar, senão a informação já era. Bits relevantes (ver SX126x.h):
  // 0x0002=RX_DONE, 0x0040=CRC_ERR, 0x0020=HEADER_ERR, 0x0200=TIMEOUT,
  // 0x0004=PREAMBLE_DETECTED. RX_DONE+CRC_ERR juntos = pacote real chegou
  // mas o conteudo veio corrompido. So CRC_ERR sem RX_DONE (ou flags
  // inesperadas) sugere outra coisa (ruido/glitch sendo mal-interpretado).
  uint32_t irqFlagsBefore = s_radio->getIrqFlags();
  size_t pendingLen = s_radio->getPacketLength(true);

  uint8_t buffer[MESH_PACKET_WIRE_SIZE];
  int state = s_radio->readData(buffer, MESH_PACKET_WIRE_SIZE);

  // Sempre re-arma o RX, mesmo se a leitura falhar — o rádio nunca pode ficar
  // "surdo" depois de um pacote malformado ou corrompido.
  s_radio->startReceive();

  if (state != RADIOLIB_ERR_NONE) {
    Serial.print("[LORA] IRQ disparou mas readData() falhou, codigo: ");
    Serial.print(state);
    Serial.print(" | irqFlags=0b");
    Serial.print(irqFlagsBefore, BIN);
    Serial.print(" pendingLen=");
    Serial.println(pendingLen);
    return;
  }

  MeshPacket packet;
  if (!meshDeserializePacket(buffer, sizeof(buffer), packet)) {
    Serial.println("[LORA] Pacote recebido mas nao deserializou (tamanho incompativel?).");
    return;
  }

  Serial.print("[LORA] RX: msgId=");
  Serial.print(packet.messageId);
  Serial.print(" src=");
  Serial.print(packet.sourceNode);
  Serial.print(" dst=");
  Serial.print(packet.destNode);
  Serial.print(" cmd=");
  Serial.print(packet.command);
  Serial.print(" rssi=");
  Serial.print(s_radio->getRSSI());
  Serial.print(" snr=");
  Serial.println(s_radio->getSNR());

  // --- Deduplicação (substitui TTL) ---
  if (rtcMeshWasSeen(packet.messageId)) {
    Serial.println("[LORA] Descartado: messageId ja visto (dedup).");
    return;
  }
  rtcMeshMarkSeen(packet.messageId);

  bool isForMe = (packet.destNode == NODE_ID) || (packet.destNode == MESH_BROADCAST_ADDR);
  bool shouldRelay = (packet.destNode != NODE_ID); // broadcast também continua se espalhando

  if (isForMe && s_rxQueue) {
    Serial.println("[LORA] Pacote e para este no, enfileirado pro core principal.");
    xQueueSend(s_rxQueue, &packet, 0); // não bloqueia; fila tem folga (ver loraTaskInit)
  }

  if (shouldRelay) {
    // Repassa com o MESMO messageId — é isso que permite os outros nós
    // deduplicarem também, sem precisar de contagem de saltos.
    Serial.println("[LORA] Repassando pacote (relay).");
    if (!enqueueForTx(packet, nullptr)) {
      Serial.println("[LORA] AVISO: fila de TX cheia, relay DESCARTADO (sem nova chance: ja esta no cache de dedup).");
    }
  }
}

void transmitPacket(const MeshPacket& packet) {
  uint8_t buffer[MESH_PACKET_WIRE_SIZE];
  meshSerializePacket(packet, buffer, sizeof(buffer));

  Serial.print("[LORA] TX: msgId=");
  Serial.print(packet.messageId);
  Serial.print(" src=");
  Serial.print(packet.sourceNode);
  Serial.print(" dst=");
  Serial.print(packet.destNode);
  Serial.print(" cmd=");
  Serial.print(packet.command);

  // LoRa é meio-duplex: precisa sair do RX pra transmitir, e depois voltar.
  s_radio->standby();
  int state = s_radio->transmit(buffer, sizeof(buffer));
  s_radio->startReceive();

  Serial.print(" -> transmit() codigo: ");
  Serial.println(state); // RADIOLIB_ERR_NONE (0) = ok; qualquer outro valor = falha real de TX
}

void loraTaskFn(void* /*param*/) {
  s_radio->setDio1Action(onRadioIrq);
  s_radio->startReceive();

  // Se acabamos de acordar de deep sleep por causa do LORA_DIO1 (ext0), o pacote
  // que causou o wakeup já pode ter terminado de chegar ANTES da linha acima
  // re-anexar a interrupção — e como é borda de subida (RISING), se o pino já
  // estiver em nível alto nesse momento, nenhuma borda nova vai disparar, e o
  // pacote ficaria parado no rádio sem nunca ser processado. Checa o nível
  // diretamente para cobrir esse caso.
  if (digitalRead(LORA_DIO1) == HIGH) {
    s_packetReceivedFlag = true;
    Serial.println("[LORA] DIO1 ja estava HIGH no boot da task — pacote pendente de antes do wakeup, processando.");
  }

  Serial.println("[LORA] Task em RX continuo no core " + String(xPortGetCoreID()));

  for (;;) {
    if (s_packetReceivedFlag) {
      s_packetReceivedFlag = false;
      handleIncomingPacket();
    }

    OutgoingPacket outgoing;
    if (xQueueReceive(s_txQueue, &outgoing, 0) == pdTRUE) {
      transmitPacket(outgoing.packet);
      s_txLastSentSeq = outgoing.seq;
    }

    vTaskDelay(1); // cede a CPU brevemente; mantém a task responsiva
  }
}

} // namespace

void loraTaskInit(SX1262* radio) {
  s_radio = radio;
  s_txQueue = xQueueCreate(8, sizeof(OutgoingPacket));
  s_rxQueue = xQueueCreate(8, sizeof(MeshPacket));
  s_txMutex = xSemaphoreCreateMutex();
}

void loraTaskDrainPendingWakePacket() {
  if (!s_radio) return;

  // So traz o SPI/pinos pra vida (Module::init() — SPI.begin() + CS em nivel
  // alto), sem tocar na configuracao do chip (isso e exatamente o que
  // radio.begin() faria a mais, e e o que estraga tudo).
  s_radio->getMod()->init();

  // Module::init() sozinho NAO basta: spiConfig comeca com o default
  // generico de registrador (estilo SX127x — stream=false, opcodes 0x00/
  // 0x80), nao o formato de comando do SX126x. Isso so e configurado dentro
  // de SX126x::modSetup(), que tambem chama findChip()/config() (destrutivo,
  // exatamente o que estamos evitando). Essas linhas sao a parte SEGURA de
  // modSetup() — so preenchem a struct em RAM, nenhuma transacao SPI
  // acontece aqui, nada toca o chip. Sem isso, getIrqFlags()/getPacketLength()
  // /readData() mandam comandos mal-formados e sempre voltam o mesmo lixo
  // (foi isso que aconteceu: irqFlags e pendingLen vinham identicos e
  // deterministicos em testes bem diferentes — sinal de protocolo errado,
  // nao de RF corrompido).
  s_radio->getMod()->spiConfig.widths[RADIOLIB_MODULE_SPI_WIDTH_ADDR] = Module::BITS_16;
  s_radio->getMod()->spiConfig.widths[RADIOLIB_MODULE_SPI_WIDTH_CMD] = Module::BITS_8;
  s_radio->getMod()->spiConfig.statusPos = 1;
  s_radio->getMod()->spiConfig.cmds[RADIOLIB_MODULE_SPI_COMMAND_READ] = RADIOLIB_SX126X_CMD_READ_REGISTER;
  s_radio->getMod()->spiConfig.cmds[RADIOLIB_MODULE_SPI_COMMAND_WRITE] = RADIOLIB_SX126X_CMD_WRITE_REGISTER;
  s_radio->getMod()->spiConfig.cmds[RADIOLIB_MODULE_SPI_COMMAND_NOP] = RADIOLIB_SX126X_CMD_NOP;
  s_radio->getMod()->spiConfig.cmds[RADIOLIB_MODULE_SPI_COMMAND_STATUS] = RADIOLIB_SX126X_CMD_GET_STATUS;
  s_radio->getMod()->spiConfig.stream = true;
  s_radio->getMod()->spiConfig.parseStatusCb = SX1262::SPIparseStatus;

  if (digitalRead(LORA_DIO1) != HIGH) {
    // Raro, mas possivel: o pacote que causou o ext0 wakeup ja foi resolvido
    // por algum motivo (ex.: IRQ de timeout, nao RxDone). Nada a fazer aqui;
    // o fluxo normal de boot/loraTaskStart segue dali.
    Serial.println("[LORA] Wakeup por LoRa, mas DIO1 ja nao esta HIGH no boot — nada pendente pra ler antes do begin().");
    return;
  }

  Serial.println("[LORA] Lendo pacote pendente do wakeup ANTES do radio.begin() limpar o IRQ do chip...");
  handleIncomingPacket();
}

void loraTaskStart() {
  xTaskCreatePinnedToCore(loraTaskFn, "lora_task", 8192, nullptr, 1, &s_taskHandle, CORE_LORA);
}

bool loraTaskSend(const MeshPacket& packet) {
  return enqueueForTx(packet, nullptr);
}

bool loraTaskSendAndWait(const MeshPacket& packet, uint32_t timeoutMs) {
  uint32_t seq = 0;
  if (!enqueueForTx(packet, &seq)) return false;

  // delay() no Arduino-ESP32 cede a CPU (vTaskDelay), então isto não impede a
  // task de LoRa de rodar e drenar a fila. Só pode ser chamado do core
  // principal: chamar de dentro da própria task de LoRa seria esperar por si
  // mesma.
  unsigned long start = millis();
  while (millis() - start < timeoutMs) {
    if (txSeqAlreadySent(seq)) return true;
    delay(5);
  }
  return false;
}

bool loraTaskWaitForTxDrain(uint32_t timeoutMs) {
  unsigned long start = millis();
  while (millis() - start < timeoutMs) {
    // Tudo que foi enfileirado já saiu quando a última seq transmitida
    // alcança a última enfileirada.
    if (txSeqAlreadySent(s_txLastQueuedSeq)) return true;
    delay(5);
  }
  return false;
}

bool loraTaskPollIncoming(MeshPacket& outPacket) {
  if (!s_rxQueue) return false;
  return xQueueReceive(s_rxQueue, &outPacket, 0) == pdTRUE;
}

void loraTaskPrepareForDeepSleep() {
  // O rádio já está em startReceive() contínuo (a task nunca sai desse
  // estado fora dos instantes de transmissão). Só falta dizer pro ESP32
  // acordar quando LORA_DIO1 for para nível alto (RX done do SX1262).
  esp_sleep_enable_ext0_wakeup((gpio_num_t)LORA_DIO1, 1);
}
