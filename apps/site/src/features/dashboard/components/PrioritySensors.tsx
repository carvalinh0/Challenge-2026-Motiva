import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPrioritySensors } from "@/utils/mowingEstimate";
import type { SensorSummary } from "@/types/sensor";

const ITEMS_PER_PAGE = 20;

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
  const [page, setPage] = useState(0);
  const priority = getPrioritySensors(sensors);
  const pageCount = Math.max(1, Math.ceil(priority.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = priority.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setPage(0);
  }, [sensors]);

  if (priority.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-300">
        Nenhum trecho com vegetação detectada.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {visible.map((sensor) => {
        const { estimate } = sensor;
        const isSelected = sensor.id.toString() === selectedSensorId;

        return (
          <button
            key={sensor.id}
            type="button"
            onClick={() => onSelect?.(sensor.id.toString())}
            className={`flex cursor-pointer items-center justify-between gap-4 rounded-lg p-4 text-left transition-colors ${
              isSelected
                ? "bg-purple-100 ring-2 ring-purple-500 dark:bg-gray-500 dark:ring-purple-400"
                : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500"
            }`}
          >
            <div>
              <p className="font-bold text-gray-800 dark:text-white">
                {sensor.name || sensor.id}
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
      {priority.length > ITEMS_PER_PAGE && (
        <div className="col-span-full flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-600">
          <span className="text-xs text-gray-500 dark:text-gray-300">
            Página {currentPage + 1} de {pageCount} · {priority.length}{" "}
            trecho(s)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={currentPage === 0}
              aria-label="Página anterior"
              className="cursor-pointer rounded-lg border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-500 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() =>
                setPage((value) => Math.min(pageCount - 1, value + 1))
              }
              disabled={currentPage === pageCount - 1}
              aria-label="Próxima página"
              className="cursor-pointer rounded-lg border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-500 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
