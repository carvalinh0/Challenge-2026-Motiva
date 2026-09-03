import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/httpClient";
import { useAuth } from "@/features/auth";
import { sensorsApi } from "../api/sensorsApi";
import type { SensorFilters, SensorSummary } from "@/types/sensor";

/**
 * Estado da listagem de sensores: carga inicial, recarga sob demanda e
 * tratamento de erro (401/403 derruba a sessão; o resto vira mensagem).
 */
export function useSensors(filters: SensorFilters) {
  const { logout } = useAuth();

  const [sensors, setSensors] = useState<SensorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.isAuthError) logout();
      else setError(err instanceof Error ? err.message : "Erro inesperado");
    },
    [logout],
  );

  // Usada por handlers de clique e após cada ação — contextos em que setState
  // é livre. A carga inicial roda inline no efeito abaixo, porque chamar esta
  // função de dentro dele contaria como setState síncrono (render em cascata).
  const reload = useCallback(async () => {
    try {
      setSensors((await sensorsApi.list(filters)) ?? []);
      setError(null);
    } catch (err) {
      handleError(err);
    }
  }, [filters, handleError]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await sensorsApi.list(filters);
        if (cancelled) return;
        setSensors(data ?? []);
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
  }, [filters, handleError]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await reload();
    setLoading(false);
  }, [reload]);

  return { sensors, loading, error, reload, refresh, handleError };
}
