import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/httpClient";
import { useAuth } from "@/features/auth";
import { sensorsApi } from "../api/sensorsApi";
import type { SensorPageQuery, SensorPageResult } from "@/types/sensor";

const EMPTY_PAGE: SensorPageResult = {
  items: [],
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

export function useSensorsPage(filters: SensorPageQuery) {
  const { logout } = useAuth();
  const [result, setResult] = useState(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.isAuthError) logout();
      else setError(err instanceof Error ? err.message : "Erro inesperado");
    },
    [logout],
  );

  const reload = useCallback(async () => {
    try {
      setResult((await sensorsApi.listPage(filters)) ?? EMPTY_PAGE);
      setError(null);
    } catch (err) {
      handleError(err);
    }
  }, [filters, handleError]);

  useEffect(() => {
    let cancelled = false;
    void sensorsApi
      .listPage(filters)
      .then((data) => {
        if (!cancelled) {
          setResult(data ?? EMPTY_PAGE);
          setError(null);
        }
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
  }, [filters, handleError]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await reload();
    setLoading(false);
  }, [reload]);

  return { ...result, loading, error, reload, refresh };
}
