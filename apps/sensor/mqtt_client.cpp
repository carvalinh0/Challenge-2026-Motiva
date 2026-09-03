#include "mqtt_client.h"
#include "config.h"
#include "command_dispatcher.h"
#include "lora_task.h"
#include <WiFi.h>
#include <PubSubClient.h> // Instalar via Library Manager: "PubSubClient" (Nick O'Leary)
#include <ArduinoJson.h>  // Instalar via Library Manager: "ArduinoJson" (Benoit Blanchon)

// Formato esperado no tópico MQTT_TOPIC_COMMAND (JSON):
//   {"targetNode": 1, "action": "MEASURE"}
//   action ∈ {"CALIBRATE", "MEASURE", "HEALTHCHECK"}
//
//   Caso especial: {"action": "..."} SEM o campo "targetNode" manda o
//   comando em broadcast pra mesh inteira, em vez de um único nó — cada
//   sensor que responder gera sua própria publicação em MQTT_TOPIC_RESULT.
//   Vale pra qualquer action (MEASURE em todos, HEALTHCHECK em todos,
//   CALIBRATE em todos — este último bem mais pesado, todo mundo recalibra
//   ao mesmo tempo).
//
// Publicado de volta em MQTT_TOPIC_RESULT:
//   {"sourceNode": 1, "action": "MEASURE", "result": 1}
//   result: ver comentários em command_dispatcher.h

namespace {

WiFiClient s_wifiClient;
PubSubClient s_mqtt(s_wifiClient);

AccelStepper* s_motor = nullptr;
VL53L1X* s_sensor = nullptr;

void reconnectMqttIfNeeded(); // definida mais abaixo; usada por publishResultJson

#define MAX_PENDING_REQUESTS 8

// Cada comando tem um custo bem diferente — HEALTHCHECK só confirma que o nó
// está vivo (sem mover nada), enquanto MEASURE/CALIBRATE fazem uma varredura
// física completa com o motor + sensor TOF ANTES de responder. Um timeout
// único pra tudo estava curto demais pra medição/calibração real:
//   MEASURE:   até MAX_SAMPLES_PER_WINDOW (256) leituras, cada uma levando
//              TIMING_BUDGET_MS (140ms) + passo do motor -> ~40s no pior caso.
//   CALIBRATE: até duas varreduras completas (CALIBRATION_LEFT_SAFETY_MAX_STEPS
//              + CALIBRATION_SAFETY_MAX_STEPS, passo a passo) -> pode passar
//              de 3 minutos no pior caso.
// Valores abaixo têm folga generosa em cima da conta acima, mais margem pra
// relay em vários saltos na mesh.
unsigned long timeoutForCommand(MeshCommand cmd) {
  switch (cmd) {
    case CMD_MEASURE:   return 90000UL;  // ~90s
    case CMD_CALIBRATE: return 240000UL; // ~4min
    case CMD_HEALTHCHECK:
    default:             return 15000UL; // sem movimento, so ida/volta na mesh
  }
}

struct PendingRequest {
  bool active;
  uint16_t targetNode;
  MeshCommand command;
  unsigned long sentAtMs;
};
PendingRequest s_pending[MAX_PENDING_REQUESTS];

// Comando sem targetNode = broadcast pra mesh inteira. Como não dá pra saber
// de antemão quais/quantos nós vão responder, isso não usa a tabela de
// pendências acima (que é 1:1 por targetNode) — fica uma janela de tempo
// aberta durante a qual QUALQUER resposta do comando em questão que chegar
// é publicada direto.
bool s_broadcastActive = false;
MeshCommand s_broadcastCommand = CMD_HEALTHCHECK;
unsigned long s_broadcastDeadlineMs = 0;

// Inverso de commandDispatchResultFor() (command_dispatcher.cpp): dado o
// CMD_RESULT_* que chegou, qual CMD_* original ele responde. Precisa disso
// pra publicar resultados autônomos (ver drainMeshResponses) — não tem
// pending request nem broadcast de onde tirar essa informação.
MeshCommand originalCommandFor(MeshCommand resultCommand) {
  switch (resultCommand) {
    case CMD_RESULT_MEASURE:     return CMD_MEASURE;
    case CMD_RESULT_HEALTHCHECK: return CMD_HEALTHCHECK;
    case CMD_RESULT_CALIBRATE:   return CMD_CALIBRATE;
    default:                     return CMD_HEALTHCHECK; // não deveria ocorrer
  }
}

const char* commandToString(MeshCommand cmd) {
  switch (cmd) {
    case CMD_CALIBRATE:   return "CALIBRATE";
    case CMD_MEASURE:     return "MEASURE";
    case CMD_HEALTHCHECK: return "HEALTHCHECK";
    default:              return "UNKNOWN";
  }
}

bool stringToCommand(const String& s, MeshCommand& out) {
  if (s == "CALIBRATE")   { out = CMD_CALIBRATE;   return true; }
  if (s == "MEASURE")     { out = CMD_MEASURE;     return true; }
  if (s == "HEALTHCHECK") { out = CMD_HEALTHCHECK; return true; }
  return false;
}

void publishResultJson(uint16_t sourceNode, MeshCommand originalCommand, uint8_t resultByte) {
  if (!s_mqtt.connected()) {
    Serial.println("[MQTT] Conexao caiu durante a operacao (provavelmente por causa da duracao); tentando reconectar antes de publicar...");
    reconnectMqttIfNeeded();
  }

  StaticJsonDocument<128> doc;
  doc["sourceNode"] = sourceNode;
  doc["action"] = commandToString(originalCommand);
  doc["result"] = resultByte;

  char buffer[128];
  size_t len = serializeJson(doc, buffer, sizeof(buffer));

  if (!s_mqtt.publish(MQTT_TOPIC_RESULT, (const uint8_t*)buffer, len)) {
    Serial.println("[MQTT] publish() falhou mesmo apos tentativa de reconexao.");
  } else {
    Serial.print("[MQTT] Publicado em ");
    Serial.print(MQTT_TOPIC_RESULT);
    Serial.print(": ");
    Serial.println(buffer);
  }
}

void addPendingRequest(uint16_t targetNode, MeshCommand command) {
  for (int i = 0; i < MAX_PENDING_REQUESTS; i++) {
    if (!s_pending[i].active) {
      s_pending[i] = { true, targetNode, command, millis() };
      return;
    }
  }
  Serial.println("[MQTT] Aviso: tabela de pedidos pendentes cheia. A resposta da mesh ainda chega, so nao vai ser correlacionada/publicada.");
}

void onMqttMessage(char* /*topic*/, byte* payload, unsigned int length) {
  StaticJsonDocument<128> doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.println("[MQTT] Payload invalido (JSON malformado).");
    return;
  }

  const char* actionStr = doc["action"] | "";

  // Inicializado só para manter a garantia local: stringToCommand() não
  // escreve em 'command' quando devolve false, e é o early return abaixo que
  // impede o uso — o compilador não enxerga isso através da chamada e emitia
  // -Wmaybe-uninitialized. HEALTHCHECK é o default inofensivo dos três (não
  // move motor). Nunca chega a ser usado.
  MeshCommand command = CMD_HEALTHCHECK;
  if (!stringToCommand(String(actionStr), command)) {
    Serial.println("[MQTT] Acao desconhecida no payload.");
    return;
  }

  bool hasTargetNode = doc.containsKey("targetNode");

  if (!hasTargetNode) {
    // Sem targetNode = broadcast pra mesh inteira, seja qual for a action.
    // O proxy tambem e um sensor, entao responde por si mesmo direto, sem
    // passar pelo radio.
    uint8_t localResult = commandDispatchExecute(command, *s_motor, *s_sensor);
    publishResultJson(NODE_ID, command, localResult);

    // Um unico pacote broadcast (destNode = MESH_BROADCAST_ADDR) e suficiente:
    // o mecanismo de relay ja existente (dedup por messageId em RTC memory,
    // ver lora_task.cpp/rtc_state.h) garante que cada no repassa esse pacote
    // NO MAXIMO uma vez, entao nao ha risco de loop mesmo sem TTL/hop-count.
    MeshPacket packet = meshBuildPacket(MESH_BROADCAST_ADDR, command, nullptr, 0);
    if (loraTaskSend(packet)) {
      s_broadcastActive = true;
      s_broadcastCommand = command;
      // +15s de folga em cima do timeout individual: no broadcast, VARIOS nos
      // respondem, cada um podendo precisar de mais saltos de relay pra
      // voltar ate o proxy do que um pedido direcionado a um so nó.
      s_broadcastDeadlineMs = millis() + timeoutForCommand(command) + 15000UL;
    } else {
      Serial.println("[MQTT] Falha ao enfileirar broadcast (fila cheia?).");
    }
    return;
  }

  uint16_t targetNode = doc["targetNode"] | (uint16_t)MESH_PROXY_NODE_ID;

  if (targetNode == NODE_ID) {
    // É pra este proxy mesmo — lembrando: o proxy também é um sensor.
    uint8_t result = commandDispatchExecute(command, *s_motor, *s_sensor);
    publishResultJson(NODE_ID, command, result);
    return;
  }

  // É pra outro nó: monta o pacote e deixa a task de LoRa cuidar do envio/relay.
  MeshPacket packet = meshBuildPacket(targetNode, command, nullptr, 0);
  if (loraTaskSend(packet)) {
    Serial.print("[MQTT] Comando ");
    Serial.print(actionStr);
    Serial.print(" enfileirado pra node ");
    Serial.print(targetNode);
    Serial.print(" (msgId=");
    Serial.print(packet.messageId);
    Serial.println(") — aguardando resposta da mesh.");
    addPendingRequest(targetNode, command);
  } else {
    Serial.println("[MQTT] Falha ao enfileirar pacote para a mesh (fila cheia?).");
  }
}

void reconnectMqttIfNeeded() {
  if (s_mqtt.connected()) return;
  if (WiFi.status() != WL_CONNECTED) return; // wifi_portal cuida da reconexao de wifi

  Serial.println("[MQTT] Conectando ao broker...");
  String clientId = "sensor-grama-proxy-" + String(NODE_ID);

  bool connected = MQTT_USE_AUTH
    ? s_mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD)
    : s_mqtt.connect(clientId.c_str());

  if (connected) {
    Serial.println("[MQTT] Conectado!");
    s_mqtt.subscribe(MQTT_TOPIC_COMMAND);
  } else {
    Serial.print("[MQTT] Falha ao conectar, rc=");
    Serial.println(s_mqtt.state());
  }
}

void checkPendingTimeouts() {
  unsigned long now = millis();
  for (int i = 0; i < MAX_PENDING_REQUESTS; i++) {
    if (s_pending[i].active && (now - s_pending[i].sentAtMs > timeoutForCommand(s_pending[i].command))) {
      Serial.print("[MQTT] Pedido para node ");
      Serial.print(s_pending[i].targetNode);
      Serial.println(" expirou sem resposta.");
      s_pending[i].active = false;
      // Poderia publicar aqui um resultado "sem resposta" (ex.: result=2)
      // se preferir que o consumidor do MQTT nao fique esperando indefinidamente.
    }
  }

  if (s_broadcastActive && now > s_broadcastDeadlineMs) {
    Serial.println("[MQTT] Janela de broadcast fechada.");
    s_broadcastActive = false;
  }
}

void drainMeshResponses() {
  MeshPacket packet;
  while (loraTaskPollIncoming(packet)) {
    // Resposta de um comando em broadcast: nao ha um targetNode unico pra
    // casar, entao qualquer resposta do comando que esta em broadcast no
    // momento e publicada direto (varios sensores diferentes podem responder).
    if (s_broadcastActive && packet.command == commandDispatchResultFor(s_broadcastCommand)) {
      uint8_t result = (packet.payloadLen > 0) ? packet.payload[0] : 2;
      publishResultJson(packet.sourceNode, s_broadcastCommand, result);
      continue;
    }

    bool matchedPending = false;
    for (int i = 0; i < MAX_PENDING_REQUESTS; i++) {
      if (s_pending[i].active && s_pending[i].targetNode == packet.sourceNode) {
        uint8_t result = (packet.payloadLen > 0) ? packet.payload[0] : 2;
        publishResultJson(packet.sourceNode, s_pending[i].command, result);
        s_pending[i].active = false;
        matchedPending = true;
        break;
      }
    }
    if (matchedPending) continue;

    // Resultado que ninguém pediu: o sensor acordou sozinho (WAKE_TIMER, ver
    // sensor_grama.ino) e reportou por conta própria, sem nenhum pending
    // request nem broadcast em andamento pra casar. Antes disso não existia
    // NENHUM caminho aqui pra esse caso — o pacote chegava (log "enfileirado
    // pro core principal"), mas o loop descartava sem publicar e sem log de
    // erro, então o histórico de medições nunca crescia sozinho. A API já
    // espera exatamente esse tipo de publicação não-solicitada (ver
    // apps/api/README.md, seção Mesh).
    if (packet.command == CMD_RESULT_MEASURE ||
        packet.command == CMD_RESULT_HEALTHCHECK ||
        packet.command == CMD_RESULT_CALIBRATE) {
      Serial.print("[MQTT] Resultado autonomo (ninguem pediu) de node ");
      Serial.print(packet.sourceNode);
      Serial.println(" — publicando mesmo assim.");
      uint8_t result = (packet.payloadLen > 0) ? packet.payload[0] : 2;
      publishResultJson(
        packet.sourceNode,
        originalCommandFor((MeshCommand)packet.command),
        result
      );
    }
  }
}

} // namespace

void mqttClientSetup(AccelStepper& motor, VL53L1X& sensor) {
  s_motor = &motor;
  s_sensor = &sensor;

  if (MQTT_PORT == 0) {
    Serial.println("[MQTT] ATENCAO: MQTT_PORT nao configurado em config.h!");
    Serial.println("[MQTT] Preencha MQTT_HOST/MQTT_PORT com os valores reais do TCP Proxy do Railway.");
  }

  s_mqtt.setServer(MQTT_HOST, MQTT_PORT);
  s_mqtt.setCallback(onMqttMessage);

  // Uma medição completa varre a janela inteira e pode levar bem mais que os
  // 15s de keepalive padrão da lib — isso rodando DENTRO do callback do MQTT
  // (bloqueando o cliente) pode fazer o broker derrubar a conexão achando que
  // o cliente morreu, e o publish() da resposta falha silenciosamente logo
  // depois. Dando bastante folga aqui pra cobrir isso.
  s_mqtt.setKeepAlive(60);
  s_mqtt.setSocketTimeout(60);
}

void mqttClientLoop() {
  reconnectMqttIfNeeded();
  s_mqtt.loop();
  drainMeshResponses();
  checkPendingTimeouts();
}
