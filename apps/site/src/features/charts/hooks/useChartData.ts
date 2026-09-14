import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/httpClient";
import { useAuth } from "@/features/auth";
import { formatDayLabel } from "@/utils/format";
import { chartsApi } from "../api/chartsApi";
import type { PeriodOption, ReadingsByDay, ReadingsBySensor } from "../types";

/** Carrega contagens agregadas; o histórico bruto nunca chega ao navegador. */
export function useChartData(period: PeriodOption) {
  const { logout } = useAuth();
  const [bySensor, setBySensor] = useState<ReadingsBySensor[]>([]);
  const [byDay, setByDay] = useState<ReadingsByDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalSensors, setTotalSensors] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.isAuthError) logout();
      else setError(err instanceof Error ? err.message : "Erro inesperado");
    },
    [logout],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void chartsApi
      .summary(period.days, page)
      .then((summary) => {
        if (cancelled) return;
        setBySensor(summary.bySensor);
        setTotalSensors(summary.totalSensors);
        setTotalPages(summary.totalPages);
        setByDay(
          summary.byDay.map((entry) => ({
            ...entry,
            label: formatDayLabel(entry.day),
            highPercent:
              entry.total > 0
                ? Math.round((entry.high / entry.total) * 100)
                : 0,
          })),
        );
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) handleError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [handleError, page, period]);

  useEffect(() => {
    setPage(1);
  }, [period]);

  const totalReadings = byDay.reduce((sum, day) => sum + day.total, 0);
  return {
    loading,
    error,
    bySensor,
    byDay,
    totalReadings,
    page,
    setPage,
    totalSensors,
    totalPages,
  };
}
