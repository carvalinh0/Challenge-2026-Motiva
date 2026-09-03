#pragma once
#include <AccelStepper.h>
#include <VL53L1X.h>

// Conecta ao broker e assina o tópico de comandos. Chamar só quando
// IS_PROXY == true, depois de wifiPortalSetupBlocking() e loraTaskStart().
// motor/sensor são usados quando o comando recebido é PARA ESTE proxy
// (lembrando: o proxy também é um sensor).
void mqttClientSetup(AccelStepper& motor, VL53L1X& sensor);

// Chamar repetidamente no loop() do proxy. Mantém a conexão MQTT viva,
// processa comandos recebidos e publica resultados (tanto locais quanto os
// que voltam da mesh via loraTaskPollIncoming).
void mqttClientLoop();
