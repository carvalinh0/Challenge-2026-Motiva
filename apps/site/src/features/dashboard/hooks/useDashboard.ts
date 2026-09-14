import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/httpClient";
import { useAuth } from "@/features/auth";
import { NIVEL, getNivel } from "@/utils/sensorStatus";
import { dashboardApi, subscribeToMeshEvents } from "../api/dashboardApi";
import type { MeshResult, SensorSummary } from "@/types/sensor";

const MAX_EVENTS = 12;

// Intervalo mínimo entre recargas disparadas pelo SSE. Sem isso, uma rajada de
// medições (resposta de um broadcast, com todos os nós respondendo quase
// juntos) vira uma requisição por evento.
const RELOAD_THROTTLE_MS = 15000;

export interface MeshEvent extends MeshResult {
  receivedAt: number;
}

/** Dados e derivados do dashboard, incluindo o feed ao vivo da mesh. */
export function useDashboard() {
  const { logout } = useAuth();

  const [sensors, setSensors] = useState<SensorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<MeshEvent[]>([]);
  const lastReload = useRef(0);
  const rateLimitUntil = useRef(0);
  const reloadInFlight = useRef<Promise<void> | null>(null);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.isAuthError) logout();
      else setError(err instanceof Error ? err.message : "Erro inesperado");
    },
    [logout],
  );

  const apply = useCallback((list: SensorSummary[]) => {
    setSensors(list);
    setError(null);
  }, []);

  // Chamada por handlers de clique e pelo callback do SSE — contextos em que
  // setState é livre. A carga inicial roda inline no efeito abaixo.
  const reload = useCallback(async () => {
    if (Date.now() < rateLimitUntil.current) return;
    if (reloadInFlight.current) return reloadInFlight.current;

    reloadInFlight.current = (async () => {
      try {
        apply(await dashboardApi.overview());
      } catch (err) {
        if (err instanceof ApiError && err.isRateLimited) {
          rateLimitUntil.current =
            Date.now() + (err.retryAfterSeconds ?? 60) * 1000;
        }
        handleError(err);
      } finally {
        reloadInFlight.current = null;
      }
    })();
    return reloadInFlight.current;
  }, [apply, handleError]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await dashboardApi.overview();
        if (!cancelled) apply(data);
      } catch (err) {
        if (err instanceof ApiError && err.isRateLimited) {
          rateLimitUntil.current =
            Date.now() + (err.retryAfterSeconds ?? 60) * 1000;
        }
        if (!cancelled) handleError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apply, handleError]);

  // Feed ao vivo: tudo que chega da mesh, inclusive o que ninguém pediu
  // (sensor reportando sozinho ao acordar pelo timer).
  useEffect(() => {
    return subscribeToMeshEvents((event) => {
      setEvents((current) =>
        [{ ...event, receivedAt: Date.now() }, ...current].slice(0, MAX_EVENTS),
      );

      // Uma medição nova muda os cards e o mapa — com limite de frequência:
      // numa rajada, uma recarga cobre todas.
      if (event.action !== "MEASURE") return;
      const now = Date.now();
      if (now - lastReload.current < RELOAD_THROTTLE_MS) return;
      lastReload.current = now;
      void reload();
    });
  }, [reload]);

  const stats = useMemo(() => computeDashboardStats(sensors), [sensors]);

  // A priorização de roçada NÃO mora aqui: ela é um cálculo puro em
  // utils/mowingEstimate (altura estimada a partir do tempo detectando), usado
  // pelos componentes NextAction e PrioritySensors. Manter uma segunda
  // definição de "próxima ação" neste hook só criaria duas respostas
  // divergentes para a mesma pergunta.
  return { sensors, loading, error, events, stats, reload, handleError };
}

// fora do hook, no mesmo arquivo
export function computeDashboardStats(sensors: SensorSummary[]) {
  // Proxy também é um nó físico da rede e deve entrar no total de sensores.
  // Apenas os níveis de vegetação continuam restritos aos sensores comuns.
  const sensorNodes = sensors;
  const vegetationSensors = sensors.filter((s) => s.type === "sensor");
  const proxies = sensors.filter((s) => s.type === "proxy");
  return {
    sensorNodes,
    proxies,
    altos: vegetationSensors.filter((s) => getNivel(s) === NIVEL.ALTO).length,
    baixos: vegetationSensors.filter((s) => getNivel(s) === NIVEL.BAIXO).length,
    offline: sensors.filter((s) => !s.active).length,
  };
}
