import { sensorsApi } from "@/features/sensors";
import type { SensorDetail } from "@/types/sensor";

/** Quantas medições puxar por sensor ao montar os gráficos. */
const HISTORY_PER_SENSOR = 200;

export const chartsApi = {
  /**
   * Histórico de todos os nós. A listagem só traz a última medição, então o
   * histórico exige uma chamada por sensor — são poucos nós, o N+1 aqui é
   * aceitável. Se a mesh crescer muito, o certo é um endpoint que devolva
   * tudo de uma vez.
   */
  history: async (): Promise<SensorDetail[]> => {
    const sensors = (await sensorsApi.list()) ?? [];
    const details = await Promise.all(
      sensors.map((sensor) => sensorsApi.get(sensor.id, HISTORY_PER_SENSOR)),
    );
    return details.filter((detail): detail is SensorDetail => detail !== null);
  },
};
