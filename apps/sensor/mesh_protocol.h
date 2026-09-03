#pragma once
#include <Arduino.h>
#include "config.h"

// Comandos que trafegam na mesh. CMD_* são pedidos; CMD_RESULT_* são respostas.
enum MeshCommand : uint8_t {
  CMD_CALIBRATE           = 1,
  CMD_MEASURE             = 2,
  CMD_HEALTHCHECK         = 3,
  CMD_RESULT_MEASURE      = 4, // payload[0] = 0 (abaixo) / 1 (acima) / 2 (sem leitura confiável)
  CMD_RESULT_HEALTHCHECK  = 5, // payload[0] = 1 (vivo)
  CMD_RESULT_CALIBRATE    = 6, // payload[0] = 1 (ok) / 0 (falhou)
};

// Pacote lógico da mesh. Sem campo de TTL/hop-count por decisão de projeto —
// o corte de flood é feito por deduplicação de messageId (ver rtc_state.h),
// não por contagem de saltos, já que o tamanho da cadeia de sensores é variável.
struct MeshPacket {
  uint32_t messageId;   // aleatório, gerado pela origem; usado só para dedup
  uint16_t sourceNode;  // NODE_ID de quem originou o pedido/resposta
  uint16_t destNode;    // NODE_ID do destinatário final, ou MESH_BROADCAST_ADDR
  uint8_t  command;     // um dos MeshCommand acima
  uint8_t  payloadLen;
  uint8_t  payload[MESH_MAX_PAYLOAD_BYTES];
};

// Tamanho fixo do pacote serializado (bytes) — mais simples e previsível que
// serialização variável, e o payload já é pequeno o bastante pra não pesar
// no airtime do LoRa.
constexpr size_t MESH_PACKET_WIRE_SIZE =
    sizeof(uint32_t) + sizeof(uint16_t) * 2 + sizeof(uint8_t) * 2 + MESH_MAX_PAYLOAD_BYTES;

// Serializa/desserializa para um buffer de bytes cru (o que radio.transmit()/
// readData() do RadioLib esperam). Retorna false se o buffer for pequeno demais.
bool meshSerializePacket(const MeshPacket& packet, uint8_t* outBuffer, size_t bufferSize);
bool meshDeserializePacket(const uint8_t* buffer, size_t bufferSize, MeshPacket& outPacket);

// Gera um messageId "aleatório o bastante" para dedup (não precisa ser
// criptograficamente forte, só improvável de colidir dentro da janela do cache).
uint32_t meshGenerateMessageId();

// Monta um MeshPacket pronto pra enviar.
MeshPacket meshBuildPacket(uint16_t destNode, MeshCommand command,
                            const uint8_t* payload, uint8_t payloadLen);
