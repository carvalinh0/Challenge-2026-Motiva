#pragma once
#include <AccelStepper.h>
#include <VL53L1X.h>
#include "mesh_protocol.h"

// Executa localmente CMD_CALIBRATE / CMD_MEASURE / CMD_HEALTHCHECK neste nó e
// devolve um único byte de resultado, pronto pra virar payload de resposta:
//   CALIBRATE   -> 1 ok / 0 falhou
//   MEASURE     -> 0 abaixo / 1 acima / 2 sem leitura confiavel
//   HEALTHCHECK -> 1 (sempre, se chegou até aqui é porque está vivo)
uint8_t commandDispatchExecute(MeshCommand command, AccelStepper& motor, VL53L1X& sensor);

