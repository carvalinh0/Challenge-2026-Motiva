// Funções puras de tradução do domínio para a tela. Sem estado, sem React,
// sem I/O — é o que permite mapa, tabela, badge e gráfico falarem a mesma
// língua sem duplicar regra.

import { MEASUREMENT_VALUE } from "@/types/sensor";
import type { SensorSummary } from "@/types/sensor";
import type { ChartColors } from "@/lib/chartTheme";

export const NIVEL = {
  ALTO: "Alto",
  BAIXO: "Baixo",
  SEM_LEITURA: "Sem leitura confiável",
  SEM_DADOS: "Sem dados",
} as const;

export type Nivel = (typeof NIVEL)[keyof typeof NIVEL];

export function nivelFromValue(value: number | null | undefined): Nivel {
  if (value == null) return NIVEL.SEM_DADOS;
  if (value === MEASUREMENT_VALUE.ABOVE_LIMIT) return NIVEL.ALTO;
  if (value === MEASUREMENT_VALUE.BELOW_LIMIT) return NIVEL.BAIXO;
  return NIVEL.SEM_LEITURA;
}

/** Proxy não mede altura de grama — por isso não tem nível. */
export function getNivel(sensor: SensorSummary): Nivel | undefined {
  if (sensor.type !== "sensor") return undefined;
  return nivelFromValue(sensor.lastMeasurement?.value);
}

/** Chave da cor na paleta dos gráficos (ver lib/chartTheme). */
export const NIVEL_COLOR_KEY: Record<Nivel, keyof ChartColors> = {
  [NIVEL.ALTO]: "alto",
  [NIVEL.BAIXO]: "baixo",
  [NIVEL.SEM_LEITURA]: "semLeitura",
  [NIVEL.SEM_DADOS]: "semDados",
};

/** Classes Tailwind do mesmo status fora dos gráficos. */
export const NIVEL_BADGE_CLASS: Record<Nivel, string> = {
  [NIVEL.ALTO]: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  [NIVEL.BAIXO]: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  [NIVEL.SEM_LEITURA]:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  [NIVEL.SEM_DADOS]: "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200",
};

/**
 * Cor do marcador do mapa em hex. Precisa ser hex, e não classe Tailwind: o
 * ícone é injetado como HTML puro no Leaflet, fora da árvore do React, então
 * não há build do Tailwind processando essas classes.
 */
export const NIVEL_MARKER_HEX: Record<Nivel, string> = {
  [NIVEL.ALTO]: "#ef4444",
  [NIVEL.BAIXO]: "#16a34a",
  [NIVEL.SEM_LEITURA]: "#f59e0b",
  [NIVEL.SEM_DADOS]: "#9ca3af",
};
