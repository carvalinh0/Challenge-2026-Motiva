import { getPrioritySensors } from "@/utils/mowingEstimate";
import type { SensorSummary } from "@/types/sensor";

interface PrioritySensorsProps {
  sensors: SensorSummary[];
  selectedSensorId?: string | null;
  onSelect?: (id: string) => void;
}

export function PrioritySensors({
  sensors,
  selectedSensorId,
  onSelect,
}: PrioritySensorsProps) {
  const priority = getPrioritySensors(sensors);

  if (priority.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-300">
        Nenhum trecho com vegetação detectada.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {priority.map((sensor) => {
        const { estimate } = sensor;
        const isSelected = sensor.id === selectedSensorId;

        return (
          <button
            key={sensor.id}
            type="button"
            onClick={() => onSelect?.(sensor.id)}
            className={`flex cursor-pointer items-center justify-between gap-4 rounded-lg p-4 text-left transition-colors ${
              isSelected
                ? "bg-purple-100 ring-2 ring-purple-500 dark:bg-gray-500 dark:ring-purple-400"
                : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500"
            }`}
          >
            <div>
              <p className="font-bold text-gray-800 dark:text-white">
                {sensor.id}
              </p>
              {estimate.estimatedHeight !== null && (
                <p className="text-sm text-gray-500 dark:text-gray-300">
                  Altura estimada: {estimate.estimatedHeight.toFixed(1)} cm
                </p>
              )}
            </div>

            <div className="text-right">
              <p
                className={`font-bold ${
                  estimate.level === "Alto" ? "text-red-600" : "text-yellow-500"
                }`}
              >
                {estimate.level}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-300">
                {estimate.daysUntilLimit === 0
                  ? "Corte urgente"
                  : `${estimate.daysUntilLimit?.toFixed(1)} dias para o limite`}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
