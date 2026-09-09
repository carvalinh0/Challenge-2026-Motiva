#include "command_dispatcher.h"
#include "grass_sensor.h"
#include "lora_task.h"

uint8_t commandDispatchExecute(MeshCommand command, AccelStepper& motor, VL53L1X& sensor) {
  switch (command) {
    case CMD_CALIBRATE: {
      loraTaskSetNodeBusy(true);
      bool ok = grassSensorCalibrate(motor, sensor);
      loraTaskSetNodeBusy(false);
      return ok ? 1 : 0;
    }
    case CMD_MEASURE: {
      loraTaskSetNodeBusy(true);
      GrassStatus status = grassSensorMeasure(motor, sensor);
      loraTaskSetNodeBusy(false);
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
