#include "command_dispatcher.h"
#include "grass_sensor.h"

uint8_t commandDispatchExecute(MeshCommand command, AccelStepper& motor, VL53L1X& sensor) {
  switch (command) {
    case CMD_CALIBRATE: {
      bool ok = grassSensorCalibrate(motor, sensor);
      return ok ? 1 : 0;
    }
    case CMD_MEASURE: {
      GrassStatus status = grassSensorMeasure(motor, sensor);
      switch (status) {
        case GrassStatus::ABAIXO_DO_LIMITE: return 0;
        case GrassStatus::ACIMA_DO_LIMITE:  return 1;
        default: return 2; // SEM_LEITURA_CONFIAVEL
      }
    }
    case CMD_HEALTHCHECK:
      return 1; // se este código está rodando, o nó está vivo
    default:
      return 2;
  }
}

MeshCommand commandDispatchResultFor(MeshCommand requestCommand) {
  switch (requestCommand) {
    case CMD_CALIBRATE:   return CMD_RESULT_CALIBRATE;
    case CMD_MEASURE:     return CMD_RESULT_MEASURE;
    case CMD_HEALTHCHECK: return CMD_RESULT_HEALTHCHECK;
    default:              return CMD_RESULT_HEALTHCHECK; // não deveria ocorrer
  }
}
