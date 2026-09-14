import { sensorsApi } from "@/features/sensors";
import type { SensorDetail } from "@/types/sensor";
import type { ReadingsByDay, ReadingsBySensor } from "../types";

/** Quantas medições puxar por sensor ao montar os gráficos. */
const HISTORY_PER_SENSOR = 200;

export const chartsApi = {
  summary: async (
    days: number | null,
    page = 1,
    limit = 50,
  ): Promise<{
    bySensor: ReadingsBySensor[];
    byDay: Omit<ReadingsByDay, "label" | "highPercent">[];
    page: number;
    totalSensors: number;
    totalPages: number;
  }> =>
    (await sensorsApi.readingsSummary(days, page, limit)) ?? {
      bySensor: [],
      byDay: [],
      page,
      totalSensors: 0,
      totalPages: 1,
    },
  /**
   * Histórico de todos os nós. A listagem só traz a última medição, então o
   * histórico exige uma chamada por sensor — são poucos nós, o N+1 aqui é
   * aceitável. Se a mesh crescer muito, o certo é um endpoint que devolva
   * tudo de uma vez.
   */
  history: async (): Promise<SensorDetail[]> => {
    return (await sensorsApi.history(HISTORY_PER_SENSOR)) ?? [];
  },
};
