// Placa DOIT ESP32 DEVKIT V1
//
// Sensor de altura de grama:
// - LoRa (SX1262) roda numa task dedicada no core CORE_LORA (RX contínuo);
//   mesh feita na mão, sem TTL — dedup por messageId persistido em RTC memory.
// - VL53L1X + motor de passo fazem a varredura e detectam altura por variância.
// - Dois papéis (config.h -> IS_PROXY):
//     sensor comum: dorme entre ciclos, acorda por timer OU por qualquer
//                   pacote LoRa recebido (mesmo que não seja pra ele).
//     proxy:        nunca dorme, é a ponte entre o broker MQTT e a mesh.
//
// Ver config.h para toda a configuração de pinos e parâmetros — inclusive
// alguns TODOs que só você pode preencher (porta do MQTT, NODE_ID por placa).

#include <RadioLib.h>
#include <Wire.h>
#include <VL53L1X.h>
#include <AccelStepper.h>
#include <esp_sleep.h>

#include "config.h"
#include "rtc_state.h"
#include "mesh_protocol.h"
#include "boot_checks.h"
#include "grass_sensor.h"
#include "command_dispatcher.h"
#include "lora_task.h"
#include "wifi_portal.h"
#include "mqtt_client.h"

Module* loraModule = new Module(LORA_NSS, LORA_DIO1, LORA_NRST, LORA_BUSY);
SX1262 radio(loraModule);
VL53L1X sensor;
AccelStepper motor(AccelStepper::HALF4WIRE, MOTOR_PIN1, MOTOR_PIN3, MOTOR_PIN2, MOTOR_PIN4);

// Quanto tempo, no máximo, um sensor comum fica acordado processando
// relay/comandos antes de voltar a dormir (quando acordou por causa de um
// pacote LoRa, não do timer). A janela reabre a cada comando tratado — ver
// runSensorCommonCycle.
#define LORA_PROCESS_WINDOW_MS 3000

// Quanto esperar, antes de desligar o rádio, pelos pacotes que ainda não
// saíram. Generoso de propósito: perder pacote aqui é perda definitiva (ver
// loraTaskWaitForTxDrain em lora_task.h), e o custo de esperar à toa é só
// bateria de um nó que já ia acordar de novo em DEEP_SLEEP_INTERVAL_US.
#define LORA_TX_DRAIN_TIMEOUT_MS 8000

namespace {

void goToDeepSleep() {
  // Nada de desligar o rádio com pacote na fila — inclusive relay que a task
  // aceitou repassar sozinha, enquanto o núcleo principal media.
  if (!loraTaskWaitForTxDrain(LORA_TX_DRAIN_TIMEOUT_MS)) {
    Serial.println("[SLEEP] AVISO: fila de TX nao esvaziou a tempo — algum pacote foi perdido.");
  }

  grassSensorPowerDownMotor(motor);
  loraTaskPrepareForDeepSleep(); // arma o wakeup por DIO1 (ext0)
  esp_sleep_enable_timer_wakeup(DEEP_SLEEP_INTERVAL_US); // + wakeup por timer, o que vier primeiro

  Serial.println("[SLEEP] Indo para deep sleep...");
  Serial.flush();
  esp_deep_sleep_start();
}

void sendEarlyHealthcheck() {
  uint8_t alive = 1;
  MeshPacket ping = meshBuildPacket(MESH_PROXY_NODE_ID, CMD_RESULT_HEALTHCHECK, &alive, 1);
  bool sent = loraTaskSendAndWait(ping, 5000);
  Serial.println(sent
    ? "[BOOT] Healthcheck inicial enviado, confirmado pelo radio."
    : "[BOOT] Healthcheck inicial NAO confirmado (timeout no TX) -- radio pode estar com problema.");
}

void runSensorCommonCycle(WakeReason wakeReason) {
  if (wakeReason == WAKE_TIMER || wakeReason == WAKE_POWER_ON) {
    // Ciclo autônomo: mede e reporta pro proxy, sem que ninguém tenha pedido.
    uint8_t result = commandDispatchExecute(CMD_MEASURE, motor, sensor);
    MeshPacket response = meshBuildPacket(MESH_PROXY_NODE_ID, CMD_RESULT_MEASURE, &result, 1);
    loraTaskSendAndWait(response, 5000);
  } else {
    // WAKE_LORA_RX: o relay automático de pacotes que NÃO são pra este nó já
    // acontece sozinho, dentro da lora_task, assim que ela sobe. Aqui só
    // tratamos comandos endereçados a ESTE nó especificamente, dando uma
    // janela curta pra isso antes de voltar a dormir.
    unsigned long windowStart = millis();
    while (millis() - windowStart < LORA_PROCESS_WINDOW_MS) {
      MeshPacket incoming;
      if (loraTaskPollIncoming(incoming)) {
        MeshCommand cmd = (MeshCommand)incoming.command;
        uint8_t result = commandDispatchExecute(cmd, motor, sensor);
        MeshPacket response = meshBuildPacket(MESH_PROXY_NODE_ID, meshResultCommandFor(cmd), &result, 1);
        loraTaskSendAndWait(response, 5000);

        // Reabre a janela. Uma MEASURE sozinha demora bem mais que
        // LORA_PROCESS_WINDOW_MS (varredura completa do motor), então sem isto
        // o laço sairia logo depois dela e qualquer comando que tivesse
        // chegado junto seria perdido: a fila de RX é heap comum, o deep sleep
        // apaga.
        windowStart = millis();
      }
      delay(20);
    }
  }
}

} // namespace

void setup() {
  Serial.begin(115200);
  delay(200); // tempo do monitor serial conectar em testes de bancada

  if (IS_PROXY && NODE_ID != MESH_PROXY_NODE_ID) {
    Serial.println("[BOOT] ERRO DE CONFIG: IS_PROXY=true mas NODE_ID != MESH_PROXY_NODE_ID (0). Corrija config.h.");
    abort();
  }

  WakeReason wakeReason = rtcDetermineWakeReason();
  Serial.print("[BOOT] Motivo do despertar (0=power-on,1=timer,2=lora_rx,3=outro): ");
  Serial.println(wakeReason);

  // --- 1) LoRa vivo? ---
  // loraTaskInit() só registra ponteiro/filas, não toca em hardware — pode
  // (e precisa) vir antes do bootCheckLoRa() nesse caso especial abaixo.
  loraTaskInit(&radio);

  // Se acordamos por causa de um pacote LoRa, o pacote pode estar parado no
  // buffer do rádio esperando ser lido — e radio.begin() (chamado logo mais
  // por bootCheckLoRa) SEMPRE limpa o status de IRQ do chip internamente
  // (SX126x::config() -> clearIrqStatus()/setDioIrqParams(NONE,NONE)),
  // independente de resetar fisicamente ou não. Se não lermos AGORA, esse
  // pacote se perde pra sempre. Ver comentário completo em lora_task.h.
  if (wakeReason == WAKE_LORA_RX) {
    loraTaskDrainPendingWakePacket();
  }

  // So reseta o chip fisicamente em power-on real. Em boots vindos de deep
  // sleep (timer ou pacote LoRa recebido), resetar destruiria o estado do
  // radio antes do firmware conseguir ler o que quer que tenha chegado —
  // ver comentario em boot_checks.h.
  bool resetRadioOnBoot = (wakeReason == WAKE_POWER_ON || wakeReason == WAKE_OTHER);
  if (!bootCheckLoRa(radio, LORA_RXEN, LORA_TXEN, resetRadioOnBoot)) {
    Serial.println("[BOOT] Falha critica no LoRa. Abortando.");
    abort();
  }

  // --- 2) Sobe a task de LoRa (core dedicado, RX contínuo + relay automático) ---
  // loraTaskInit() já rodou lá em cima (antes do bootCheckLoRa) — aqui só
  // falta subir a task de verdade, que vai re-armar o RX pra próximos
  // pacotes (o pendente do wakeup, se houver, já foi lido e enfileirado).
  // Feito ANTES do sensor TOF/calibração de propósito: aquilo pode travar ou
  // abortar (grassSensorCalibrate), e sem a task de LoRa rodando nesse ponto
  // não haveria NENHUM jeito de avisar o proxy que o boot chegou até aqui.
  loraTaskStart();

  if (!IS_PROXY && wakeReason == WAKE_POWER_ON) {
    sendEarlyHealthcheck();
  }

  // --- 3) Sensor TOF vivo? ---
  // (Sem checagem de motor — o ULN2003/28BYJ-48 não tem retorno elétrico pra
  // isso, decisão consciente já discutida.)
  if (!bootCheckSensor(sensor, TOF_SDA, TOF_SCL)) {
    Serial.println("[BOOT] Falha critica no sensor TOF. Abortando.");
    abort();
  }

  grassSensorInitMotor(motor);

  // --- 4) Calibrar? ---
  // Decidido por rtcIsCalibrated() (estado real da RTC memory), não só pelo
  // motivo do despertar — assim cobre também casos como um restart via
  // ESP.restart() (portal WiFi), onde a RTC memory tipicamente sobrevive e
  // recalibrar seria desnecessário.
  if (!rtcIsCalibrated()) {
    loraTaskSetNodeBusy(true);
    bool calibrated = grassSensorCalibrate(motor, sensor);
    loraTaskSetNodeBusy(false);

    if (!calibrated) {
      Serial.println("[BOOT] Falha na calibracao. O no vai subir SEM janela:");
      Serial.println("[BOOT] responde healthcheck, mas toda medicao sai como SEM_LEITURA_CONFIAVEL.");
      Serial.println("[BOOT] Nova tentativa a cada wake, ou sob comando CALIBRATE pela mesh.");
    }
  } else {
    Serial.println("[BOOT] Calibracao ja presente na RTC memory, pulando.");
  }

  if (IS_PROXY) {
    wifiPortalSetupBlocking();   // bloqueia ate ter WiFi (ou reinicia apos configurar)
    mqttClientSetup(motor, sensor);
    Serial.println("[BOOT] Proxy pronto. Nao vai dormir — loop() cuida do resto.");
  } else {
    runSensorCommonCycle(wakeReason);
    goToDeepSleep(); // não deveria retornar
  }
}

void loop() {
  if (IS_PROXY) {
    mqttClientLoop();
  }
  // Sensores comuns nunca chegam aqui de verdade: setup() termina em deep sleep.
}
