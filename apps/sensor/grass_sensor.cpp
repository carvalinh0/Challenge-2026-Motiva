#include "grass_sensor.h"
#include "config.h"
#include "rtc_state.h"

namespace {

struct SensorSample {
  bool valid;          // dá pra usar essa distância como medida de verdade
  bool hasTarget;      // o chip afirma que existe alvo (status não é "sem alvo / fora de alcance")
  uint16_t distance_mm;
  float signalRate;    // MCPS, corrigido de crosstalk
  float ambientRate;   // luz IR de fundo (ex.: sol)
  float sigma_mm;      // incerteza que o PRÓPRIO chip estima pra essa distância
  uint8_t status;      // RangeStatus já traduzido pela biblioteca
  bool timedOut;
};

VL53L1X* g_sensor = nullptr; // setado no início de cada chamada pública, pra uso nos helpers internos

// Só estes status significam "existe um alvo ali na frente":
//   RangeValid                -> medida boa
//   RangeValidMinRangeClipped -> alvo mais perto do que o mínimo do sensor
//                                (~40mm). É EXATAMENTE o caso da parede do
//                                case, então não pode ser descartado aqui.
//
// Todo o resto (SignalFail, SigmaFail, OutOfBoundsFail, WrapTargetFail,
// RangeValidNoWrapCheckFail...) significa "não confie no número". Isso importa
// muito porque, quando o alvo está ALÉM do alcance, o VL53L1X NÃO devolve um
// valor grande: o eco volta ambíguo e ele reporta uma distância CURTA qualquer
// (é a origem do "apontei pro teto e ele disse 50mm"). Por isso o teste
// `distancia < MAX_SENSOR_RANGE_MM` sozinho nunca detecta fora de alcance —
// quem detecta é o status, o sinal e o sigma.
//
// Atenção a RangeValidNoWrapCheckFail (6): ele aparece quando stream_count==0,
// ou seja, quando o chip não teve amostra anterior pra fazer a checagem de
// wraparound. É justamente a situação em que um alvo longe demais pode ser
// reportado como perto, então fica de fora de propósito. Se o log de debug
// mostrar MUITA leitura com status=6, é sinal de que vale trocar o readSingle()
// por startContinuous()/read() na varredura.
bool statusHasTarget(uint8_t status) {
  return status == VL53L1X::RangeValid ||
         status == VL53L1X::RangeValidMinRangeClipped;
}

// "Tem algo mais perto do que eu consigo medir" (~40mm). A ST descreve os DOIS
// status abaixo com a MESMA frase — "Target is below minimum detection
// threshold" — e rotula um como válido (3) e o outro como falha (13). A
// diferença é de confiança na DISTÂNCIA reportada, não na existência do
// obstáculo, e para calibrar a distância não interessa: dentro da cápsula, a
// única coisa a 40mm é a parede.
//
// Isso importa porque é uma afirmação GEOMÉTRICA do chip, não fotométrica: não
// depende de comparar sinal com luz de fundo. É o único critério de parede que
// continua de pé sob sol, e foi a falta dele que fez a calibração só funcionar
// em baixa luminosidade.
bool statusBelowMinRange(uint8_t status) {
  return status == VL53L1X::RangeValidMinRangeClipped ||
         status == VL53L1X::MinRangeFail;
}

// Por que esta amostra foi descartada. A ordem importa: é a PRIMEIRA causa na
// cadeia, que é o que interessa em campo — "o sol está matando o sinal" e "o
// alvo está fora de alcance" dão o mesmo resultado final e causas bem
// diferentes aqui.
enum class RejectReason : uint8_t { Nenhum, Timeout, Status, Sinal, Sigma, ForaDeAlcance };

const char* rejectReasonName(RejectReason reason) {
  switch (reason) {
    case RejectReason::Nenhum:        return "ok";
    case RejectReason::Timeout:       return "timeout";
    case RejectReason::Status:        return "status";
    case RejectReason::Sinal:         return "sinal";
    case RejectReason::Sigma:         return "sigma";
    case RejectReason::ForaDeAlcance: return "fora_alcance";
  }
  return "?";
}

RejectReason rejectReasonFor(const SensorSample& s) {
  if (s.timedOut)                           return RejectReason::Timeout;
  if (s.status != VL53L1X::RangeValid)      return RejectReason::Status;
  if (s.signalRate < MIN_SIGNAL_RATE)       return RejectReason::Sinal;
  if (s.sigma_mm > MAX_SIGMA_MM)            return RejectReason::Sigma;
  if (s.distance_mm >= MAX_SENSOR_RANGE_MM) return RejectReason::ForaDeAlcance;
  return RejectReason::Nenhum;
}

SensorSample readValidatedDistance() {
  SensorSample sample;
  sample.distance_mm = g_sensor->readSingle();
  sample.timedOut = g_sensor->timeoutOccurred();

  if (sample.timedOut) {
    // readSingle() aborta ANTES de atualizar ranging_data quando estoura o
    // timeout, então tudo que estivesse lá seria da amostra anterior.
    sample.hasTarget = false;
    sample.valid = false;
    sample.signalRate = 0.0f;
    sample.ambientRate = 0.0f;
    sample.sigma_mm = 0.0f;
    sample.status = VL53L1X::None;
    sample.valid = false;
    return sample;
  }

  sample.status = (uint8_t)g_sensor->ranging_data.range_status;
  sample.signalRate = g_sensor->ranging_data.peak_signal_count_rate_MCPS;
  sample.ambientRate = g_sensor->ranging_data.ambient_count_rate_MCPS;
  // A biblioteca não expõe sigma em ranging_data; lemos o registrador direto
  // (escala 14.2 fixo, conforme a ST). Os registradores ficam latcheados até a
  // próxima medição terminar, então isto ainda é DESTA amostra.
  sample.sigma_mm = g_sensor->readReg16Bit(VL53L1X::RESULT__SIGMA_SD0) / 4.0f;

  sample.hasTarget = statusHasTarget(sample.status);
  // rejectReasonFor() é a única definição de "válida" — antes a checagem
  // ficava duplicada aqui e no diagnóstico, e as duas podiam divergir.
  sample.valid = (rejectReasonFor(sample) == RejectReason::Nenhum);
  return sample;
}

// Indica "reflexão forte de algo bem perto" (ex.: a parede da cápsula).
// Exige TRÊS coisas ao mesmo tempo:
//  1) O chip confirmar que há alvo (ver statusHasTarget) e que ele está PERTO.
//     Sem essa checagem, uma leitura fora de alcance — que vem com distância
//     curta aliasada e sinal alto — passava por parede.
//  2) Sinal acima de um piso absoluto mínimo (evita disparar em ruído baixo).
//  3) Sinal pelo menos CALIBRATION_WALL_SIGNAL_TO_AMBIENT_RATIO vezes maior
//     que o ambiente NO MESMO INSTANTE — é o que evita confundir "muito IR de
//     fundo" (sol direto, que eleva sinal E ambiente juntos) com um reflexo de
//     verdade (que eleva o sinal MUITO mais que o ambiente).
bool looksLikeRealWall(const SensorSample& sample) {
  if (sample.timedOut) return false;

  // Caminho independente de luz ambiente. Vem PRIMEIRO e é suficiente sozinho:
  // sob sol, a razão sinal/ambiente abaixo desaba (vegetação reflete ~50% em
  // 940nm, então a cena inteira vira uma fonte de IR) e vetava a parede mesmo
  // com ela a 40mm do sensor. Blindar o sensor não resolve — quem está
  // iluminado é o alvo, não o receptor.
  if (statusBelowMinRange(sample.status)) return true;

  if (!sample.hasTarget) return false;
  if (sample.distance_mm > CALIBRATION_WALL_MAX_DISTANCE_MM) return false;
  if (sample.signalRate < CALIBRATION_WALL_SIGNAL_THRESHOLD_MCPS) return false;

  float ambientFloor = max(sample.ambientRate, 0.01f); // evita divisão por zero em ambiente bem escuro
  float ratio = sample.signalRate / ambientFloor;
  return ratio >= CALIBRATION_WALL_SIGNAL_TO_AMBIENT_RATIO;
}

#if DEBUG_CALIBRATION || DEBUG_MEASUREMENT
// Campos comuns a todo log de leitura, sem quebrar linha — quem chama
// acrescenta o que for específico da sua fase e fecha com println().
void printSampleFields(const SensorSample& s) {
  Serial.print(" dist_mm=");
  Serial.print(s.timedOut ? -1 : (int)s.distance_mm);
  Serial.print(" signal=");
  Serial.print(s.signalRate, 3);
  Serial.print(" ambient=");
  Serial.print(s.ambientRate, 3);
  Serial.print(" ratio=");
  Serial.print(s.signalRate / max(s.ambientRate, 0.01f), 2);
  Serial.print(" sigma_mm=");
  Serial.print(s.sigma_mm, 1);
  Serial.print(" status=");
  Serial.print(s.status);
  Serial.print("(");
  Serial.print(VL53L1X::rangeStatusToString((VL53L1X::RangeStatus)s.status));
  Serial.print(") alvo=");
  Serial.print(s.hasTarget ? 1 : 0);
  Serial.print(" valid=");
  Serial.print(s.valid ? 1 : 0);
}
#endif

struct EdgeResult {
  bool found;
  long stepsMoved;
  bool everArmed; // chegou a ver campo aberto? (só pra diagnóstico)
};

// Move o motor 1 incremento por vez até detectar uma borda, ou até esgotar
// maxSteps.
//
// ARMAR ANTES DE DETECTAR
// -----------------------
// A busca só pode declarar uma borda DEPOIS de ver CALIBRATION_OPEN_STREAK_TO_ARM
// leituras seguidas sem parede, e depois de andar pelo menos
// CALIBRATION_MIN_EDGE_SEPARATION_STEPS. Sem essas duas travas, a busca da
// borda DIREITA começa exatamente em cima da borda ESQUERDA que acabou de ser
// encontrada e a redetecta nos primeiros passos: em HALF4WIRE, 4 passos são
// ~0,35°, então um streak de 4 leituras cobre ~1,4° — a mesma parede continua
// no campo de visão o tempo todo. O resultado era uma janela calibrada de ~16
// passos, colada na parede, e uma medição inteira feita a milímetros dela
// (onde o VL53L1X fica abaixo do alcance mínimo e devolve 0/1mm).
//
// Duas condições contam como borda, uma vez armado:
//  1) Um salto grande de distância entre duas leituras VÁLIDAS consecutivas
//     (>= CALIBRATION_JUMP_THRESHOLD_MM) — reforço; nos testes reais a
//     aproximação da parede foi sempre suave, nunca deu salto.
//  2) Várias leituras SEGUIDAS com cara de parede (>= CALIBRATION_WALL_STREAK_LIMIT).
EdgeResult findEdge(AccelStepper& motor, int direction, long maxSteps) {
  EdgeResult result = { false, 0, false };

  // Agregados usados só quando a busca FALHA. Passo a passo o log já sai
  // completo, mas são ~1000 linhas por varredura: no campo, sob sol, ninguém
  // lê isso num celular. Estes números dizem numa linha o que o sensor
  // enxergou no percurso inteiro.
  float bestSignal = 0.0f;
  float bestRatio = 0.0f;
  uint16_t closest = 0xFFFF;
  int statusCounts[14] = { 0 };
  int statusOther = 0;

  SensorSample previous = readValidatedDistance();
  long stepsMoved = 0;
  int wallStreak = 0;
  int openStreak = looksLikeRealWall(previous) ? 0 : 1;
  bool armed = false;

#if DEBUG_CALIBRATION
  Serial.print("[CAL] dir=");
  Serial.print(direction);
  Serial.print(" passo=0 (inicial)");
  printSampleFields(previous);
  Serial.print(" parede=");
  Serial.println(looksLikeRealWall(previous) ? 1 : 0);
#endif

  while (stepsMoved < maxSteps) {
    motor.move(direction * CALIBRATION_STEP_INCREMENT);
    motor.runToPosition();
    delay(CALIBRATION_SETTLE_DELAY_MS);
    stepsMoved += CALIBRATION_STEP_INCREMENT;

    SensorSample current = readValidatedDistance();
    bool wallLike = looksLikeRealWall(current);

    if (!current.timedOut) {
      if (current.status < 14) statusCounts[current.status]++;
      else statusOther++;

      if (current.signalRate > bestSignal) bestSignal = current.signalRate;

      float ratio = current.signalRate / max(current.ambientRate, 0.01f);
      if (ratio > bestRatio) bestRatio = ratio;

      if ((statusHasTarget(current.status) || statusBelowMinRange(current.status)) &&
          current.distance_mm < closest) {
        closest = current.distance_mm;
      }
    }

    if (wallLike) {
      wallStreak++;
      openStreak = 0;
    } else {
      wallStreak = 0;
      openStreak++;
      if (!armed && openStreak >= CALIBRATION_OPEN_STREAK_TO_ARM) {
        armed = true;
        result.everArmed = true;
#if DEBUG_CALIBRATION
        Serial.print("[CAL] armado (saiu da parede) no passo ");
        Serial.println(stepsMoved);
#endif
      }
    }

#if DEBUG_CALIBRATION
    Serial.print("[CAL] dir=");
    Serial.print(direction);
    Serial.print(" passo=");
    Serial.print(stepsMoved);
    printSampleFields(current);
    Serial.print(" parede=");
    Serial.print(wallLike ? 1 : 0);
    Serial.print(" streak=");
    Serial.print(wallStreak);
    Serial.print(" armado=");
    Serial.println(armed ? 1 : 0);
#endif

    // Enquanto não estiver armado (ou perto demais do ponto de partida),
    // nenhuma borda pode ser declarada — é só a parede anterior ainda em vista.
    if (armed && stepsMoved >= CALIBRATION_MIN_EDGE_SEPARATION_STEPS) {
      // Critério 1: salto entre leituras válidas (reforço, raramente dispara na prática)
      if (current.valid && previous.valid) {
        int delta = (int)current.distance_mm - (int)previous.distance_mm;
        if (abs(delta) >= CALIBRATION_JUMP_THRESHOLD_MM) {
#if DEBUG_CALIBRATION
          Serial.print("[CAL] BORDA por SALTO de distancia valida, delta_mm=");
          Serial.println(delta);
#endif
          result.found = true;
          result.stepsMoved = stepsMoved;
          return result;
        }
      }

      // Critério 2: parede sustentada — o que realmente funcionou nos testes
      if (wallStreak >= CALIBRATION_WALL_STREAK_LIMIT) {
#if DEBUG_CALIBRATION
        Serial.println("[CAL] BORDA por sinal forte sustentado (parede de verdade).");
#endif
        result.found = true;
        result.stepsMoved = stepsMoved;
        return result;
      }
    }

    previous = current;
  }

#if DEBUG_CALIBRATION
  Serial.print("[CAL] FALHOU: esgotou maxSteps sem achar borda. armado=");
  Serial.println(result.everArmed ? 1 : 0);

  Serial.print("[CAL] no caminho: melhor_sinal=");
  Serial.print(bestSignal, 2);
  Serial.print(" melhor_razao=");
  Serial.print(bestRatio, 2);
  Serial.print(" mais_perto_mm=");
  if (closest == 0xFFFF) Serial.print("nenhum"); else Serial.print(closest);
  Serial.print(" | status:");
  for (int st = 0; st < 14; st++) {
    if (statusCounts[st] == 0) continue;
    Serial.print(" ");
    Serial.print(VL53L1X::rangeStatusToString((VL53L1X::RangeStatus)st));
    Serial.print("=");
    Serial.print(statusCounts[st]);
  }
  if (statusOther > 0) {
    Serial.print(" outros=");
    Serial.print(statusOther);
  }
  Serial.println();
  if (!result.everArmed) {
    Serial.println("[CAL] Nunca viu campo aberto: o sensor enxergou 'parede' o curso inteiro.");
    Serial.println("[CAL] Suspeita de reflexo interno do case (crosstalk) — rode apps/sensor-tools/case_scan e suba CALIBRATION_WALL_SIGNAL_THRESHOLD_MCPS.");
  }
#endif
  return result;
}

uint16_t g_sampleBuffer[MAX_SAMPLES_PER_WINDOW];

// Posição de repouso: o MEIO da janela calibrada. É onde o motor tem que ficar
// sempre que termina de trabalhar (fim de calibração, fim de medição, antes de
// dormir).
//
// Não é organização à toa: quem começa uma calibração precisa começar em campo
// aberto. findEdge() só declara uma borda depois de ARMAR — ver N leituras
// seguidas sem parede — então uma recalibração que começa parada perto de uma
// parede nunca arma, e varre o curso inteiro de teto enxergando o interior do
// case. Parar no meio garante que a próxima calibração comece longe das duas
// bordas.
void parkAtRest(AccelStepper& motor) {
  long rest = rtcGetWindowStart() + (rtcGetWindowEnd() - rtcGetWindowStart()) / 2;
  motor.moveTo(rest);
  motor.runToPosition();

  // Nada mais move o motor depois daqui (calibração e medição terminam neste
  // ponto, e o deep sleep não mexe nele), então esta é a posição com que o nó
  // vai dormir — é ela que o próximo boot precisa restaurar.
  rtcSetMotorPosition(motor.currentPosition());

  Serial.print("[MOTOR] Em repouso no meio da janela (passo ");
  Serial.print(rest);
  Serial.println(").");
}

} // namespace

void grassSensorInitMotor(AccelStepper& motor) {
  pinMode(MOTOR_PIN1, OUTPUT);
  pinMode(MOTOR_PIN2, OUTPUT);
  pinMode(MOTOR_PIN3, OUTPUT);
  pinMode(MOTOR_PIN4, OUTPUT);
  pinMode(STEP_POWER_PIN, OUTPUT);

  motor.setMaxSpeed(1000.0); // na prática mal sai da rampa: movimentos são de poucos passos
  motor.setAcceleration(200.0);

  // Restaura o referencial da calibração em vez de zerar cegamente. Zerar aqui
  // significava "onde quer que o motor esteja agora é o passo 0" — e como o nó
  // acorda com o motor no repouso (meio da janela), a janela guardada na RTC
  // passava a ser interpretada a partir dali. A varredura então começava meia
  // janela à direita do que devia, atravessava a parede no meio do caminho e
  // media o interior do case; o repouso seguinte caía sobre a parede direita, e
  // o erro se acumulava meia janela por ciclo.
  if (rtcHasMotorPosition()) {
    motor.setCurrentPosition(rtcGetMotorPosition());
    Serial.print("[MOTOR] Posicao restaurada da RTC: passo ");
    Serial.println(rtcGetMotorPosition());
  } else {
    motor.setCurrentPosition(0);
  }

  digitalWrite(STEP_POWER_PIN, HIGH);
}

bool grassSensorCalibrate(AccelStepper& motor, VL53L1X& sensor) {
  g_sensor = &sensor;

  Serial.println("[CALIBRACAO] Iniciando...");
  rtcClearMotorPosition();
  motor.setCurrentPosition(0); // referência: posição física no momento em que ligou

  // Onde o motor estava quando esta calibração começou, expresso no sistema de
  // coordenadas ATUAL (que muda quando o zero é redefinido na borda esquerda).
  // Serve pra devolver o motor ao ponto de partida se a calibração falhar, em
  // vez de deixá-lo abandonado a centenas de passos de onde começou —
  // exatamente a situação que faz a calibração SEGUINTE começar encostada numa
  // parede e nunca conseguir armar.
  long originPosition = 0;

  EdgeResult left = findEdge(motor, -1, CALIBRATION_LEFT_SAFETY_MAX_STEPS);

  if (left.found) {
    motor.setCurrentPosition(0);
    originPosition = left.stepsMoved; // o ponto de partida ficou à direita do novo zero
    Serial.print("[CALIBRACAO] Borda esquerda apos ");
    Serial.print(left.stepsMoved);
    Serial.println(" passos. Zero definido aqui.");
  } else {
    Serial.println("[CALIBRACAO] Nenhuma borda a esquerda dentro do limite seguro do cabo.");
    Serial.println("[CALIBRACAO] Voltando ao ponto de partida e assumindo esse ponto como zero.");
    motor.moveTo(0);
    motor.runToPosition();
    motor.setCurrentPosition(0);
  }

  EdgeResult right = findEdge(motor, +1, CALIBRATION_SAFETY_MAX_STEPS);
  if (!right.found) {
    Serial.println("[CALIBRACAO] Falha: borda direita nao encontrada. Voltando ao ponto de partida.");
    motor.moveTo(originPosition);
    motor.runToPosition();
    return false;
  }

  Serial.print("[CALIBRACAO] Borda direita apos ");
  Serial.print(right.stepsMoved);
  Serial.println(" passos a partir do zero.");

  // A janela ÚTIL fica recuada das duas paredes: varrer encostado nelas coloca
  // o alvo abaixo do alcance mínimo do VL53L1X e produz leituras de 0/1mm.
  long windowStart = CALIBRATION_EDGE_MARGIN_STEPS;
  long windowEnd = right.stepsMoved - CALIBRATION_EDGE_MARGIN_STEPS;

  if (windowEnd - windowStart < CALIBRATION_MIN_WINDOW_STEPS) {
    Serial.print("[CALIBRACAO] Falha: janela util de apenas ");
    Serial.print(windowEnd - windowStart);
    Serial.print(" passos (minimo ");
    Serial.print(CALIBRATION_MIN_WINDOW_STEPS);
    Serial.println(").");
    Serial.println("[CALIBRACAO] Isso quase sempre significa que as duas 'bordas' sao a MESMA parede,");
    Serial.println("[CALIBRACAO] ou que o reflexo interno do case esta sendo lido como parede.");
    motor.moveTo(originPosition);
    motor.runToPosition();
    return false;
  }

  rtcSetCalibratedWindow(windowStart, windowEnd);
  Serial.print("[CALIBRACAO] Janela calibrada: passos ");
  Serial.print(windowStart);
  Serial.print(" a ");
  Serial.print(windowEnd);
  Serial.print(" (");
  Serial.print(windowEnd - windowStart);
  Serial.println(" passos uteis).");

  parkAtRest(motor);

  return true;
}

void grassSensorPowerDownMotor(AccelStepper& motor) {
  motor.disableOutputs();
  digitalWrite(STEP_POWER_PIN, LOW);

  Serial.print("[MOTOR] Desligado para dormir (posicao ");
  Serial.print(motor.currentPosition());
  Serial.println(" salva na RTC).");
}

GrassStatus grassSensorMeasure(AccelStepper& motor, VL53L1X& sensor) {
  g_sensor = &sensor;

  if (!rtcIsCalibrated()) {
    Serial.println("[MEDICAO] Abortada: nao ha janela calibrada na RTC memory.");
    return GrassStatus::SEM_LEITURA_CONFIAVEL;
  }

  long windowStart = rtcGetWindowStart();
  long windowEnd = rtcGetWindowEnd();

  long totalSteps = windowEnd - windowStart;
  int expectedSamples = (int)(totalSteps / MEASUREMENT_STEP_INCREMENT);
  if (expectedSamples > MAX_SAMPLES_PER_WINDOW) expectedSamples = MAX_SAMPLES_PER_WINDOW;
  if (expectedSamples < 1) expectedSamples = 1;

  Serial.print("[MEDICAO] Varrendo passos ");
  Serial.print(windowStart);
  Serial.print(" a ");
  Serial.print(windowEnd);
  Serial.print(" em ");
  Serial.print(expectedSamples);
  Serial.println(" amostras.");

  // Sai do repouso (meio da janela) e vai pro começo dela, junto da borda
  // esquerda, pra varrer a janela inteira num sentido só.
  motor.moveTo(windowStart);
  motor.runToPosition();

  int validCount = 0;
  int rejectCounts[6] = { 0, 0, 0, 0, 0, 0 };
  float ambientSum = 0.0f;
  uint16_t minValid = 0xFFFF;
  uint16_t maxValid = 0;

  for (int i = 0; i < expectedSamples; i++) {
    delay(MEASUREMENT_SETTLE_DELAY_MS); // mesmo settle da calibração: ler logo após parar o motor pega vibração
    SensorSample s = readValidatedDistance();

#if DEBUG_MEASUREMENT
    Serial.print("[MED] amostra=");
    Serial.print(i);
    Serial.print(" pos=");
    Serial.print(motor.currentPosition());
    printSampleFields(s);
    Serial.println();
#endif

    rejectCounts[(int)rejectReasonFor(s)]++;
    ambientSum += s.ambientRate;

    if (s.valid) {
      g_sampleBuffer[validCount] = s.distance_mm;
      validCount++;
      if (s.distance_mm < minValid) minValid = s.distance_mm;
      if (s.distance_mm > maxValid) maxValid = s.distance_mm;
    }

    motor.move(MEASUREMENT_STEP_INCREMENT);
    motor.runToPosition();
  }

  // Termina a varredura na borda direita: volta pro repouso, no meio da janela.
  parkAtRest(motor);

  float validRatio = (float)validCount / (float)expectedSamples;
  Serial.print("[MEDICAO] Amostras validas: ");
  Serial.print(validCount);
  Serial.print("/");
  Serial.print(expectedSamples);
  Serial.print(" (");
  Serial.print(validRatio * 100.0f, 1);
  Serial.println("%).");

  Serial.print("[MEDICAO] descartes:");
  for (int r = (int)RejectReason::Timeout; r <= (int)RejectReason::ForaDeAlcance; r++) {
    if (rejectCounts[r] == 0) continue;
    Serial.print(" ");
    Serial.print(rejectReasonName((RejectReason)r));
    Serial.print("=");
    Serial.print(rejectCounts[r]);
  }

  Serial.print(" | ambiente_medio=");
  Serial.print(ambientSum / expectedSamples, 3);
  if (validCount > 0) {
    Serial.print(" | validas_mm=[");
    Serial.print(minValid);
    Serial.print("..");
    Serial.print(maxValid);
    Serial.print("]");
  }
  Serial.println();

  // Variância de uma amostra só é sempre 0 — não dá pra classificar nada com isso.
  if (validCount < 2 || validRatio < MIN_VALID_SAMPLE_RATIO) {
    return GrassStatus::SEM_LEITURA_CONFIAVEL;
  }

  float mean = 0;
  for (int i = 0; i < validCount; i++) mean += g_sampleBuffer[i];
  mean /= validCount;

  float variance = 0;
  for (int i = 0; i < validCount; i++) {
    float diff = g_sampleBuffer[i] - mean;
    variance += diff * diff;
  }
  variance /= validCount;

  if (mean < MIN_SENSOR_RANGE_MM) {
    Serial.print("[MEDICAO] media_mm=");
    Serial.print(mean, 1);
    Serial.print(" abaixo do alcance minimo (");
    Serial.print(MIN_SENSOR_RANGE_MM);
    Serial.println("mm): nenhum alvo dentro do alcance.");
    Serial.println("[MEDICAO] Veredito: ABAIXO_DO_LIMITE (grama abaixo da altura do sensor).");
    return GrassStatus::ABAIXO_DO_LIMITE;
  }

  Serial.print("[MEDICAO] media_mm=");
  Serial.print(mean, 1);
  Serial.print(" variancia=");
  Serial.print(variance, 1);
  Serial.print(" limite=");
  Serial.println(VARIANCE_THRESHOLD, 1);

  return (variance >= VARIANCE_THRESHOLD)
    ? GrassStatus::ACIMA_DO_LIMITE
    : GrassStatus::ABAIXO_DO_LIMITE;
}
