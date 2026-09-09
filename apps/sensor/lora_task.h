#pragma once
#include <RadioLib.h>
#include "mesh_protocol.h"

// Deve ser chamado no core principal ANTES de bootCheckLoRa()/radio.begin()
// em boots que vêm de deep sleep — só registra o ponteiro do rádio e cria as
// filas, não toca em hardware, então é seguro chamar cedo. Ver
// loraTaskDrainPendingWakePacket() logo abaixo pra entender por quê precisa
// ser ANTES do begin().
void loraTaskInit(SX1262* radio);

// Só faz sentido chamar quando o boot foi por WAKE_LORA_RX (ver
// rtc_state.h), e tem que ser ANTES de bootCheckLoRa()/radio.begin().
//
// Motivo: radio.begin() do RadioLib — mesmo com resetOnStartup=false (ver
// boot_checks.h) — chama internamente SX126x::config(), que sempre limpa o
// status de IRQ do chip e desmapeia o DIO1 (clearIrqStatus() +
// setDioIrqParams(IRQ_NONE, IRQ_NONE), incondicional, não depende de
// resetOnStartup). Isso apaga a informação "tem pacote esperando" ANTES do
// firmware ter qualquer chance de ler o pacote que causou o wakeup — mesmo
// sem resetar o chip fisicamente.
//
// Essa função contorna isso: reproduz só a parte SEGURA (não-destrutiva) de
// SX126x::modSetup() — Module::init() (SPI/pinos) + preencher
// mod->spiConfig com o formato de comando do SX126x (isso é só um struct em
// RAM, nenhuma transação SPI acontece aqui) — e PULA a parte destrutiva
// (findChip()/config(), que é o que limpa o IRQ). Só então chama
// radio.readData(), que passa a falar com o chip no protocolo certo.
// radio.getMod()/mod->spiConfig são protected/internos — só acessíveis aqui
// por causa do #define RADIOLIB_GODMODE 1 no topo de lora_task.cpp.
// (Duas tentativas anteriores — SPI.begin() manual, depois só
// Module::init() sem o spiConfig — não bastavam: sem o spiConfig certo, os
// comandos saem mal-formados e o chip sempre devolve o mesmo lixo
// determinístico, não um erro de RF de verdade.) O pacote lido passa pelo
// mesmo caminho normal de dedup/relay/fila que qualquer outro pacote
// recebido.
void loraTaskDrainPendingWakePacket();

// Sobe a task de LoRa pinada em CORE_LORA (ver config.h). A partir daqui ela
// nunca para sozinha: fica sempre em RX, deduplica via cache RTC (sem TTL —
// ver mesh_protocol.h/rtc_state.h) e decide sozinha quando repassar um pacote
// que não é para este nó.
void loraTaskStart();

// Enfileira um pacote para envio. Não bloqueia — a task de LoRa transmite
// assim que possível, pausando o RX por uma fração de segundo pra isso.
bool loraTaskSend(const MeshPacket& packet);

// Como acima, mas bloqueia até ESTE pacote terminar de ser transmitido (ou o
// timeout vencer). A espera é por número de ordem, não por "alguma
// transmissão aconteceu": num nó que faz relay, o rádio transmite pacotes de
// outros o tempo todo, e confundir os dois fazia esta função voltar true com
// o pacote ainda na fila — que o deep sleep logo em seguida descartava.
//
// Chamar só do core principal: de dentro da task de LoRa, seria esperar por
// si mesma.
bool loraTaskSendAndWait(const MeshPacket& packet, uint32_t timeoutMs);

// Espera a fila de transmissão esvaziar por completo — inclusive os pacotes
// de relay que a task aceitou repassar por conta própria.
//
// Obrigatório antes do deep sleep: o nó marca cada messageId no cache de
// dedup (RTC memory, sobrevive ao sono) ANTES de repassar, então um pacote
// que fica na fila quando o chip desliga não volta — se passar de novo, será
// descartado como duplicado. Sem TTL e sem ACK no protocolo, some de vez.
//
// Devolve false se o timeout venceu com coisa ainda pendente.
bool loraTaskWaitForTxDrain(uint32_t timeoutMs);

// Tenta retirar da fila um pacote endereçado a ESTE nó (já deduplicado pela
// task). Não bloqueia; retorna false se não houver nada pendente.
bool loraTaskPollIncoming(MeshPacket& outPacket);

// Avisa a task de LoRa que o núcleo principal está ocupado com o hardware
// (varredura de medição ou calibração) e não vai drenar a fila de entrada tão
// cedo — uma medição leva bem mais que o intervalo entre dois healthchecks.
//
// Enquanto ocupado, a própria task responde HEALTHCHECK direto do rádio, sem
// esperar o núcleo principal. Isso muda o significado da resposta e a mudança é
// deliberada: ocupado, "vivo" passa a provar que o rádio e a mesh estão de pé,
// não que o núcleo principal está. Em compensação, é a única janela em que o
// nó ficaria mudo — e um nó mudo é indistinguível de um nó morto do lado da
// API. Quando o núcleo está livre, quem responde continua sendo ele, e a
// resposta segue provando tudo como antes.
//
// Só afeta HEALTHCHECK. MEASURE e CALIBRATE continuam enfileirados: existe um
// motor só, e não há como executá-los em paralelo.
void loraTaskSetNodeBusy(bool busy);

// Configura o DIO1 como fonte de wakeup (ext0) para o PRÓXIMO deep sleep.
// Chamar isso depois que a task de LoRa já estiver em RX contínuo, e sempre
// imediatamente antes de esp_deep_sleep_start().
void loraTaskPrepareForDeepSleep();
