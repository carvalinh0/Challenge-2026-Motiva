#pragma once
#include <VL53L1X.h>
#include <AccelStepper.h>

enum class GrassStatus {
  ABAIXO_DO_LIMITE,      // grama <= 15 cm (pouca variação nas leituras)
  ACIMA_DO_LIMITE,       // grama > 15 cm (muita variação nas leituras)
  SEM_LEITURA_CONFIAVEL  // amostras válidas insuficientes nessa varredura
};

// POSIÇÃO DE REPOUSO
// ------------------
// Tanto grassSensorCalibrate() quanto grassSensorMeasure() terminam com o
// motor parado no MEIO da janela calibrada. Quem varre é a medição, que sai do
// repouso, vai até a borda esquerda e percorre a janela inteira num sentido só.
//
// Isso não é só arrumação: findEdge() só declara uma borda depois de ARMAR —
// ou seja, de ver leituras seguidas SEM parede. Uma calibração que começa com
// o motor parado perto de uma parede nunca arma e acaba varrendo o curso
// inteiro enxergando o interior do case. Parar no meio garante que a próxima
// calibração comece em campo aberto.

// Inicializa os pinos do motor (chamar uma vez no setup, sempre).
void grassSensorInitMotor(AccelStepper& motor);

// Executa a calibração (giro esquerda -> direita detectando salto de
// distância) e SALVA o resultado na memória RTC. Só deve ser chamada quando
// rtcIsCalibrated() == false (tipicamente só em power-on/reset — ver rtc_state.h).
// Retorna false se não conseguir calibrar (ex.: borda direita nunca encontrada).
bool grassSensorCalibrate(AccelStepper& motor, VL53L1X& sensor);

// Executa uma varredura completa da janela já calibrada (lida da RTC) e
// retorna o status de altura da grama.
GrassStatus grassSensorMeasure(AccelStepper& motor, VL53L1X& sensor);

// Corta a alimentação do motor. Chamar imediatamente antes do deep sleep.
//
// As bobinas de um motor de passo consomem corrente PARADAS — é assim que ele
// segura posição. Num nó que dorme 30 min por ciclo, deixar isso ligado
// dominaria o consumo inteiro. Aqui não há o que segurar: o 28BYJ-48 é
// engrenado (1:64) e não retrocede sozinho sem alimentação.
//
// Depende de a posição estar persistida na RTC (ver rtcSetMotorPosition): sem
// isso, cortar a energia seria perder o referencial da janela calibrada.
void grassSensorPowerDownMotor(AccelStepper& motor);
