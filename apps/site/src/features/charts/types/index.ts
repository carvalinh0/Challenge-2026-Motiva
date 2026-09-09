/** Presets do filtro de período. `days: null` = sem recorte. */
export interface PeriodOption {
  label: string;
  days: number | null;
}

export const PERIOD_OPTIONS: readonly PeriodOption[] = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
  { label: "Tudo", days: null },
] as const;

/** Uma linha do gráfico de barras empilhadas (um nó). */
export interface ReadingsBySensor {
  id: number;
  Alto: number;
  Baixo: number;
  "Sem leitura": number;
  total: number;
}

/** Um ponto das séries temporais (um dia). */
export interface ReadingsByDay {
  day: string;
  label: string;
  total: number;
  high: number;
  highPercent: number;
}
