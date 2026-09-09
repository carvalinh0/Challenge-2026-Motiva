import { formatDuration, addMinutesToClock } from "@/utils/format";
import type { RoutePlan } from "@/utils/routePlanner";
import type { RouteCandidateSensor } from "../hooks/useRoutePlan";

interface RouteItineraryProps {
  plan: RoutePlan;
  candidates: RouteCandidateSensor[];
  /** Horário de saída da base, "HH:MM". */
  departure: string;
}

function heightOf(candidates: RouteCandidateSensor[], id: number): number | null {
  return candidates.find((candidate) => candidate.id === id)?.estimatedHeight ?? null;
}

export function RouteItinerary({ plan, candidates, departure }: RouteItineraryProps) {
  if (plan.stops.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-300">
        Nenhuma parada no roteiro.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {plan.stops.map((stop, index) => {
        const height = heightOf(candidates, stop.id);
        return (
          <li
            key={stop.id}
            className="flex items-center gap-4 rounded-lg bg-gray-100 p-3 dark:bg-gray-600"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6126F1] text-sm font-bold text-white">
              {index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-gray-800 dark:text-white">{stop.id}</p>
              <p className="text-xs text-gray-500 dark:text-gray-300">
                {stop.score - 1} dia(s) em alto
                {height !== null && ` · ~${height.toFixed(0)} cm`}
              </p>
            </div>

            <div className="text-right text-sm whitespace-nowrap text-gray-700 dark:text-gray-200">
              <p className="font-medium">
                {addMinutesToClock(departure, stop.arrivalSeconds / 60)}
                {" – "}
                {addMinutesToClock(departure, stop.departureSeconds / 60)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-300">
                chega em {formatDuration(stop.arrivalSeconds)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
