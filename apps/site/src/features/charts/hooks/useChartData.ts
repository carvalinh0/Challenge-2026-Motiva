import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/httpClient";
import { useAuth } from "@/features/auth";
import { MEASUREMENT_VALUE } from "@/types/sensor";
import { formatDayLabel, toIsoDay } from "@/utils/format";
import { chartsApi } from "../api/chartsApi";
import type { SensorDetail } from "@/types/sensor";
import type { PeriodOption, ReadingsByDay, ReadingsBySensor } from "../types";

/** Agrega o histórico bruto nas séries que cada gráfico consome. */
export function useChartData(period: PeriodOption) {
  const { logout } = useAuth();

  const [series, setSeries] = useState<SensorDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Instante de referência da janela. Fica em estado, atualizado no
  // carregamento, porque Date.now() durante o render é impuro — daria um
  // recorte diferente a cada re-render.
  const [loadedAt, setLoadedAt] = useState(() => Date.now());

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.isAuthError) logout();
      else setError(err instanceof Error ? err.message : "Erro inesperado");
    },
    [logout],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const details = await chartsApi.history();
        if (cancelled) return;
        setSeries(details);
        setLoadedAt(Date.now());
        setError(null);
      } catch (err) {
        if (!cancelled) handleError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handleError, period]);

  const since = useMemo(
    () => (period.days ? loadedAt - period.days * 24 * 60 * 60 * 1000 : 0),
    [period, loadedAt],
  );

  const bySensor = useMemo<ReadingsBySensor[]>(
    () =>
      series
        .filter((sensor) => sensor.type === "sensor")
        .map((sensor) => {
          const readings = (sensor.lastMeasurements ?? []).filter(
            (m) => m.timestamp >= since,
          );
          return {
            id: sensor.id,
            Alto: readings.filter((m) => m.value === MEASUREMENT_VALUE.ABOVE_LIMIT).length,
            Baixo: readings.filter((m) => m.value === MEASUREMENT_VALUE.BELOW_LIMIT).length,
            "Sem leitura": readings.filter(
              (m) => m.value === MEASUREMENT_VALUE.UNRELIABLE,
            ).length,
            total: readings.length,
          };
        })
        .filter((row) => row.total > 0),
    [series, since],
  );

  const byDay = useMemo<ReadingsByDay[]>(() => {
    const days = new Map<string, { day: string; total: number; high: number }>();
    for (const sensor of series) {
      for (const measurement of sensor.lastMeasurements ?? []) {
        if (measurement.timestamp < since) continue;
        const day = toIsoDay(measurement.timestamp);
        const entry = days.get(day) ?? { day, total: 0, high: 0 };
        entry.total += 1;
        if (measurement.value === MEASUREMENT_VALUE.ABOVE_LIMIT) entry.high += 1;
        days.set(day, entry);
      }
    }
    return [...days.values()]
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((entry) => ({
        ...entry,
        label: formatDayLabel(entry.day),
        highPercent: Math.round((entry.high / entry.total) * 100),
      }));
  }, [series, since]);

  const totalReadings = byDay.reduce((sum, day) => sum + day.total, 0);

  return { loading, error, bySensor, byDay, totalReadings };
}
