import { formatDuration, addMinutesToClock } from "@/utils/format";
import { useState } from "react";
import type { RoutePlan } from "@/utils/routePlanner";
import type { RouteCandidateSensor } from "../hooks/useRoutePlan";

interface RouteItineraryProps {
  plan: RoutePlan;
  candidates: RouteCandidateSensor[];
  /** Horário de saída da base, "HH:MM". */
  departure: string;
  onDefer: (sensorId: number) => void | Promise<void>;
  allowDefer?: boolean;
  onMove?: (from: number, to: number) => void;
}

function heightOf(
  candidates: RouteCandidateSensor[],
  id: number,
): number | null {
  return (
    candidates.find((candidate) => candidate.id === id)?.estimatedHeight ?? null
  );
}

function nameOf(candidates: RouteCandidateSensor[], id: number): string {
  return (
    candidates.find((candidate) => candidate.id === id)?.name || String(id)
  );
}

export function RouteItinerary({
  plan,
  candidates,
  departure,
  onDefer,
  allowDefer = true,
  onMove,
}: RouteItineraryProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  if (plan.stops.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-300">
        Nenhuma parada no roteiro.
      </p>
    );
  }

  return (
    <ol className="max-h-[24rem] space-y-2 overflow-y-auto pr-2">
      {plan.stops.map((stop, index) => {
        const height = heightOf(candidates, stop.id);
        return (
          <li
            key={stop.id}
            draggable={Boolean(onMove)}
            onDragStart={() => {
              setDraggedIndex(index);
              setDropIndex(null);
            }}
            onDragOver={(event) => {
              if (!onMove) return;
              event.preventDefault();
              setDropIndex(index);
            }}
            onDragLeave={() => setDropIndex(null)}
            onDrop={(event) => {
              event.preventDefault();
              if (onMove && draggedIndex !== null && draggedIndex !== index) {
                onMove(draggedIndex, index);
              }
              setDraggedIndex(null);
              setDropIndex(null);
            }}
            onDragEnd={() => {
              setDraggedIndex(null);
              setDropIndex(null);
            }}
            className={`flex items-center gap-4 rounded-lg p-3 transition-colors dark:bg-gray-600 ${
              dropIndex === index
                ? "bg-purple-100 ring-2 ring-purple-400 dark:bg-gray-500"
                : "bg-gray-100"
            } ${onMove ? "cursor-grab active:cursor-grabbing" : ""}`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6126F1] text-sm font-bold text-white">
              {index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-gray-800 dark:text-white">
                {nameOf(candidates, stop.id)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-300">
                {stop.score - 1} dia(s) em alto
                {height !== null && ` · ~${height.toFixed(0)} cm`}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2 text-right text-sm text-gray-700 dark:text-gray-200">
              <p className="font-medium">
                {addMinutesToClock(departure, stop.arrivalSeconds / 60)}
                {" – "}
                {addMinutesToClock(departure, stop.departureSeconds / 60)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-300">
                chega em {formatDuration(stop.arrivalSeconds)}
              </p>
              {allowDefer && (
                <button
                  type="button"
                  onClick={() => onDefer(stop.id)}
                  className="cursor-pointer rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-white dark:border-gray-500 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Fazer depois
                </button>
              )}
              {onMove && (
                <span className="text-xs text-gray-400 dark:text-gray-300">
                  Arraste para reordenar
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
