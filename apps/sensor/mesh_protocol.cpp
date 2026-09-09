#include "mesh_protocol.h"
#include "rtc_state.h"
#include <cstring>
#include <esp_system.h>

bool meshSerializePacket(const MeshPacket& packet, uint8_t* outBuffer, size_t bufferSize) {
  if (bufferSize < MESH_PACKET_WIRE_SIZE) return false;

  size_t offset = 0;
  memcpy(outBuffer + offset, &packet.messageId, sizeof(packet.messageId)); offset += sizeof(packet.messageId);
  memcpy(outBuffer + offset, &packet.sourceNode, sizeof(packet.sourceNode)); offset += sizeof(packet.sourceNode);
  memcpy(outBuffer + offset, &packet.destNode, sizeof(packet.destNode)); offset += sizeof(packet.destNode);
  outBuffer[offset++] = packet.command;
  outBuffer[offset++] = packet.payloadLen;
  memcpy(outBuffer + offset, packet.payload, MESH_MAX_PAYLOAD_BYTES); offset += MESH_MAX_PAYLOAD_BYTES;

  return true;
}

bool meshDeserializePacket(const uint8_t* buffer, size_t bufferSize, MeshPacket& outPacket) {
  if (bufferSize < MESH_PACKET_WIRE_SIZE) return false;

  size_t offset = 0;
  memcpy(&outPacket.messageId, buffer + offset, sizeof(outPacket.messageId)); offset += sizeof(outPacket.messageId);
  memcpy(&outPacket.sourceNode, buffer + offset, sizeof(outPacket.sourceNode)); offset += sizeof(outPacket.sourceNode);
  memcpy(&outPacket.destNode, buffer + offset, sizeof(outPacket.destNode)); offset += sizeof(outPacket.destNode);
  outPacket.command = buffer[offset++];
  outPacket.payloadLen = buffer[offset++];
  memcpy(outPacket.payload, buffer + offset, MESH_MAX_PAYLOAD_BYTES); offset += MESH_MAX_PAYLOAD_BYTES;

  return true;
}

uint32_t meshGenerateMessageId() {
  // esp_random() é um gerador de hardware (RNG analógico da ESP32), disponível
  // mesmo antes do WiFi ser inicializado — melhor que millis()/rand() aqui,
  // que dariam colisão fácil logo após um power-on (contadores zerados).
  return esp_random();
}

MeshCommand meshResultCommandFor(MeshCommand requestCommand) {
  switch (requestCommand) {
    case CMD_CALIBRATE:   return CMD_RESULT_CALIBRATE;
    case CMD_MEASURE:     return CMD_RESULT_MEASURE;
    case CMD_HEALTHCHECK: return CMD_RESULT_HEALTHCHECK;
    default:              return CMD_RESULT_HEALTHCHECK; // não deveria ocorrer
  }
}

MeshPacket meshBuildPacket(uint16_t destNode, MeshCommand command,
                            const uint8_t* payload, uint8_t payloadLen) {
  MeshPacket packet = {};
  packet.messageId = meshGenerateMessageId();
  packet.sourceNode = NODE_ID;
  packet.destNode = destNode;
  packet.command = command;

  if (payloadLen > MESH_MAX_PAYLOAD_BYTES) payloadLen = MESH_MAX_PAYLOAD_BYTES;
  packet.payloadLen = payloadLen;
  if (payload != nullptr && payloadLen > 0) {
    memcpy(packet.payload, payload, payloadLen);
  }

  // Marca o próprio messageId como visto NO MOMENTO em que é gerado, não só
  // quando um pacote é recebido. Sem isso, se este pacote voltar pro
  // remetente por qualquer motivo (eco por acoplamento de RF em curta
  // distância, reflexo, etc.), o dedup em rtc_state.cpp ainda não conhece
  // esse messageId — o nó trataria o próprio eco como um pacote novo de
  // outra origem e repassaria (ver lora_task.cpp: shouldRelay é true sempre
  // que destNode != NODE_ID, e um pacote unicast que este nó originou tem
  // destNode != NODE_ID quase sempre). Marcando aqui, o eco é descartado
  // de cara, sem gastar mais um ciclo de TX.
  rtcMeshMarkSeen(packet.messageId);

  return packet;
}
