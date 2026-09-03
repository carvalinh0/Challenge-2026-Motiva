#pragma once
#include <RadioLib.h>
#include <VL53L1X.h>

// Inicializa o rádio e confirma que respondeu corretamente. Retorna true se ok.
// (O motor não entra aqui: o ULN2003/28BYJ-48 não tem nenhum retorno elétrico
// que permita saber se está "vivo" — decisão tomada conscientemente.)
//
// resetOnStartup=false é ESSENCIAL em boots que vêm de deep sleep (timer ou
// LoRa RX): radio.begin() com reset (o padrão) pulsa o NRST do SX1262, o que
// limpa o buffer/estado interno do chip — inclusive o pacote que ACABOU de
// chegar e causou o wakeup, antes que o firmware tenha qualquer chance de
// lê-lo. Resetar só faz sentido em power-on real, quando o estado do chip é
// desconhecido. Ver RadioLib PhysicalLayer::resetOnStartup.
bool bootCheckLoRa(SX1262& radio, int rxenPin, int txenPin, bool resetOnStartup);

// Inicializa o barramento I2C e o sensor TOF, configurando modo/timing/ROI.
bool bootCheckSensor(VL53L1X& sensor, int sdaPin, int sclPin);
