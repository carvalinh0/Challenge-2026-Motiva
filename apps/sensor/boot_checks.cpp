#include "boot_checks.h"
#include "config.h"
#include <Wire.h>

bool bootCheckLoRa(SX1262& radio, int rxenPin, int txenPin, bool resetOnStartup) {
  radio.resetOnStartup = resetOnStartup;
  int state = radio.begin(RADIO_FREQUENCY);

  if (state != RADIOLIB_ERR_NONE) {
    Serial.print("[BOOT] Falha no LoRa, codigo: ");
    Serial.println(state);
    return false;
  }

  radio.setRfSwitchPins(rxenPin, txenPin);
  Serial.println("[BOOT] LoRa e chave de RF configurados!");
  return true;
}

bool bootCheckSensor(VL53L1X& sensor, int sdaPin, int sclPin) {
  Wire.begin(sdaPin, sclPin);
  Wire.setClock(100000); // 100kHz (Standard Mode, mais estavel)
  sensor.setTimeout(1000);

  if (!sensor.init()) {
    Serial.println("[BOOT] Falha critica: nao foi possivel detectar o sensor TOF!");
    Serial.println("[BOOT] Verifique as conexoes fisicas e os resistores de pull-up.");
    return false;
  }

  sensor.setDistanceMode(MEASUREMENT_DISTANCE_MODE);
  sensor.setMeasurementTimingBudget(TIMING_BUDGET_MS * 1000);
  sensor.setROISize(8, 8);

  Serial.println("[BOOT] Sensor TOF detectado com sucesso!");
  return true;
}
