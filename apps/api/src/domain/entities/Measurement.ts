// Valor de uma medição, exatamente como sai do firmware (ver
// apps/sensor/command_dispatcher.h). A API não reinterpreta esses códigos —
// quem exibe decide como traduzir.
export const MEASUREMENT_VALUE = {
    BELOW_LIMIT: 0,
    ABOVE_LIMIT: 1,
    UNRELIABLE: 2,
} as const;

export type MeasurementValue =
    (typeof MEASUREMENT_VALUE)[keyof typeof MEASUREMENT_VALUE];

export interface Measurement {
    id: number;
    /** Id do nó que reportou — o NODE_ID da mesh (ver Sensor.id). */
    sensorId: number;
    value: number;
    timestamp: Date;
}

// -----------------------------------------------------------------------
// Prioridade de roçada
// -----------------------------------------------------------------------
// Quanto tempo o sensor vem detectando vegetação acima do limite é o que
// ordena a fila de roçada. Isso NÃO é o mesmo que "há quanto tempo o nó não
// reporta": um nó mudo há duas semanas não tem grama alta, tem rádio com
// problema.

/** Até onde olhar para trás ao contar a sequência. */
const STREAK_LOOKBACK_DAYS = 60;

/**
 * Quantos dias seguidos sem NENHUMA leitura interrompem a contagem. Existe
 * para um nó que sumiu não continuar acumulando prioridade em cima de
 * leituras antigas.
 */
const STREAK_MAX_SILENT_DAYS = 2;

/** Dia do calendário local. A API e a equipe compartilham fuso. */
function localDayKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

interface DayVerdict {
    high: boolean;
    low: boolean;
}

/**
 * Dias consecutivos, contando de hoje para trás, em que o sensor reportou
 * acima do limite.
 *
 * Regras por dia, nesta ordem:
 *  - qualquer leitura ABAIXO do limite encerra a sequência (a grama foi
 *    cortada, ou nunca esteve alta);
 *  - senão, pelo menos uma leitura ACIMA conta o dia;
 *  - só leituras "sem leitura confiável" não contam nem encerram — o sensor
 *    não sabe o que viu, e chutar em qualquer direção seria pior;
 *  - dia sem nenhuma leitura também não encerra, até o limite de
 *    STREAK_MAX_SILENT_DAYS seguidos.
 */
export function consecutiveHighDays(
    measurements: Measurement[],
    now: Date = new Date(),
): number {
    const byDay = new Map<string, DayVerdict>();

    for (const measurement of measurements) {
        const key = localDayKey(measurement.timestamp);
        const verdict = byDay.get(key) ?? { high: false, low: false };
        if (measurement.value === MEASUREMENT_VALUE.ABOVE_LIMIT) verdict.high = true;
        if (measurement.value === MEASUREMENT_VALUE.BELOW_LIMIT) verdict.low = true;
        byDay.set(key, verdict);
    }

    let streak = 0;
    let silentDays = 0;
    const cursor = new Date(now);

    for (let i = 0; i < STREAK_LOOKBACK_DAYS; i++) {
        const verdict = byDay.get(localDayKey(cursor));

        if (!verdict) {
            silentDays++;
            if (silentDays > STREAK_MAX_SILENT_DAYS) break;
        } else if (verdict.low) {
            break;
        } else {
            silentDays = 0;
            if (verdict.high) streak++;
        }

        cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
}
