// Estimativa de altura da vegetação e urgência de roçada.
//
// O sensor não mede altura em cm: ele só diz "acima" ou "abaixo" do limite
// (ver apps/api/README.md). A altura aqui é INFERIDA a partir de há quantos
// DIAS SEGUIDOS o nó vem reportando "acima", assumindo uma taxa de crescimento
// constante. É uma aproximação para priorizar trechos, não uma medição.
//
// A contagem de dias vem da API (`consecutiveHighDays`), não do timestamp da
// última leitura. Usar o timestamp confundia "grama crescendo" com "nó mudo":
// um sensor sem reportar há duas semanas aparecia com 29 cm de vegetação e
// corte urgente, quando o problema era o rádio.

import type { SensorSummary } from "@/types/sensor";

/** Altura em que o sensor passa a detectar a grama (altura de instalação). */
const SENSOR_HEIGHT_CM = 15;
/** Crescimento assumido por dia. Ajustar com dados reais de campo. */
const GROWTH_RATE_CM_PER_DAY = 1;
/** A partir daqui a roçada é considerada urgente. */
const HIGH_LIMIT_CM = 30;

export type MowingLevel = "Alto" | "Médio" | "Baixo";

export interface MowingEstimate {
  /** null quando o sensor não está detectando vegetação. */
  estimatedHeight: number | null;
  level: MowingLevel;
  daysDetecting: number;
  /** null quando não há vegetação detectada; 0 quando já passou do limite. */
  daysUntilLimit: number | null;
}

export interface SensorWithEstimate extends SensorSummary {
  estimate: MowingEstimate;
}

/**
 * "Está pedindo roçada agora?" — decidido pela sequência de dias em alto, não
 * pela última leitura isolada. Uma única leitura "sem leitura confiável" no fim
 * do dia tirava da fila um trecho com duas semanas de vegetação; a sequência já
 * trata leitura duvidosa como inconclusiva em vez de negativa.
 */
function isDetectingVegetation(sensor: SensorSummary): boolean {
  return sensor.consecutiveHighDays > 0;
}

export function getMowingEstimate(sensor: SensorSummary): MowingEstimate | null {
  if (sensor.type !== "sensor") return null;

  const measurement = sensor.lastMeasurement;
  if (!measurement) return null;

  if (!isDetectingVegetation(sensor)) {
    return {
      estimatedHeight: null,
      level: "Baixo",
      daysDetecting: 0,
      daysUntilLimit: null,
    };
  }

  const daysDetecting = sensor.consecutiveHighDays;
  const estimatedHeight = SENSOR_HEIGHT_CM + daysDetecting * GROWTH_RATE_CM_PER_DAY;

  const daysUntilLimit =
    estimatedHeight >= HIGH_LIMIT_CM
      ? 0
      : (HIGH_LIMIT_CM - estimatedHeight) / GROWTH_RATE_CM_PER_DAY;

  return {
    estimatedHeight,
    level: estimatedHeight >= HIGH_LIMIT_CM ? "Alto" : "Médio",
    daysDetecting,
    daysUntilLimit,
  };
}

/** Sensores detectando vegetação, do mais urgente para o menos. */
export function getPrioritySensors(sensors: SensorSummary[]): SensorWithEstimate[] {
  return sensors
    .filter((sensor) => sensor.type === "sensor" && isDetectingVegetation(sensor))
    .map((sensor) => ({ sensor, estimate: getMowingEstimate(sensor) }))
    .filter(
      (item): item is { sensor: SensorSummary; estimate: MowingEstimate } =>
        item.estimate !== null,
    )
    .map(({ sensor, estimate }) => ({ ...sensor, estimate }))
    // Desempate por id porque a contagem de dias é inteira e empata bastante —
    // sem ele a mesma lista sairia em ordens diferentes a cada recarga.
    .sort(
      (a, b) =>
        b.estimate.daysDetecting - a.estimate.daysDetecting ||
        a.id.localeCompare(b.id),
    );
}

export function getMostUrgentSensor(
  sensors: SensorSummary[],
): SensorWithEstimate | null {
  return getPrioritySensors(sensors)[0] ?? null;
}
