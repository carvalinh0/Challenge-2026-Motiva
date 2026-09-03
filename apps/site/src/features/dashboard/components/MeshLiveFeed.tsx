import { formatTime } from "@/utils/format";
import { NIVEL_BADGE_CLASS, nivelFromValue } from "@/utils/sensorStatus";
import type { MeshEvent } from "../hooks/useDashboard";

/** Lista das últimas respostas que chegaram da mesh por SSE. */
export function MeshLiveFeed({ events }: { events: MeshEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-300">
        Nada ainda. Sensores reportam sozinhos ao acordar, ou use “Medir todos”.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-600">
      {events.map((event, index) => (
        <li
          key={`${event.receivedAt}-${index}`}
          className="flex flex-wrap items-center justify-between gap-2 py-2"
        >
          <span className="text-gray-800 dark:text-gray-100">
            <span className="font-medium">node {event.sourceNode}</span>{" "}
            <span className="text-gray-500 dark:text-gray-300">{event.action}</span>
          </span>
          <span className="flex items-center gap-3">
            {event.action === "MEASURE" && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  NIVEL_BADGE_CLASS[nivelFromValue(event.result)]
                }`}
              >
                {nivelFromValue(event.result)}
              </span>
            )}
            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-300">
              {formatTime(event.receivedAt)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
