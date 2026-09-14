import { getMostUrgentSensor } from "@/utils/mowingEstimate";
import type { SensorSummary } from "@/types/sensor";

/** O trecho que mais pede roçada agora — a única linha do dashboard que
 *  sugere o que fazer, e não apenas o que está acontecendo. */
export function NextAction({ sensors }: { sensors: SensorSummary[] }) {
  const urgent = getMostUrgentSensor(sensors);

  if (!urgent) {
    return (
      <div className="flex h-32 flex-col items-center justify-center text-center">
        <p className="font-bold text-green-600">Nenhuma roçada necessária</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
          Nenhum sensor está detectando vegetação.
        </p>
      </div>
    );
  }

  const { estimate } = urgent;

  return (
    <div className="flex flex-col items-center text-center">
      <p className="mt-3 font-bold text-gray-800 dark:text-white">{urgent.name}</p>

      {estimate.estimatedHeight !== null && (
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          Altura estimada:{" "}
          <span className="font-bold">{estimate.estimatedHeight.toFixed(1)} cm</span>
        </p>
      )}

      <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">
        {estimate.daysUntilLimit === 0
          ? "Vegetação acima do limite recomendado."
          : `Aproximadamente ${estimate.daysUntilLimit?.toFixed(1)} dias para atingir o limite.`}
      </p>
    </div>
  );
}
