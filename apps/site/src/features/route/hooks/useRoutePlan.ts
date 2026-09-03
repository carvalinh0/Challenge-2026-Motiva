import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/httpClient";
import { ROUTE_SETTINGS_STORAGE_KEY } from "@/config/constants";
import { getPrioritySensors } from "@/utils/mowingEstimate";
import { planMowingRoute } from "@/utils/routePlanner";
import type { RouteCandidate, RoutePlan } from "@/utils/routePlanner";
import { routeApi } from "../api/routeApi";
import type { GeoPoint, RouteMatrix, SensorSummary } from "@/types/sensor";

export interface RouteSettings {
  /** De onde a equipe sai e para onde volta. null = ainda não definida. */
  base: GeoPoint | null;
  /** Quantas paradas fazer. Alvo exato: se não couber, a tela avisa. */
  targetStops: number;
  workdayHours: number;
  serviceMinutes: number;
  /** Horário de saída, "HH:MM", só para exibir os horários estimados. */
  departure: string;
}

export const DEFAULT_ROUTE_SETTINGS: RouteSettings = {
  base: null,
  targetStops: 5,
  workdayHours: 8,
  serviceMinutes: 45,
  departure: "07:00",
};

function loadSettings(): RouteSettings {
  try {
    const stored = localStorage.getItem(ROUTE_SETTINGS_STORAGE_KEY);
    if (!stored) return DEFAULT_ROUTE_SETTINGS;
    return { ...DEFAULT_ROUTE_SETTINGS, ...(JSON.parse(stored) as Partial<RouteSettings>) };
  } catch {
    // Chave corrompida (edição manual, versão antiga do formato) não pode
    // impedir a tela de abrir.
    return DEFAULT_ROUTE_SETTINGS;
  }
}

/** Sensor candidato a entrar no roteiro, já com coordenada garantida. */
export interface RouteCandidateSensor extends RouteCandidate {
  point: GeoPoint;
  daysDetecting: number;
  estimatedHeight: number | null;
}

/**
 * Só entram sensores que estão detectando vegetação AGORA e têm coordenada
 * cadastrada — sem coordenada não há como roteirizar.
 *
 * A pontuação é `dias seguidos em alto + 1`. O +1 existe porque um trecho que
 * acabou de passar do limite ainda vale mais do que não ir a lugar nenhum; com
 * pontuação zero a densidade de valor zeraria para todo mundo no primeiro dia
 * e a escolha viraria arbitrária.
 */
function toCandidates(sensors: SensorSummary[]): RouteCandidateSensor[] {
  return getPrioritySensors(sensors)
    .filter((sensor) => sensor.latitude !== null && sensor.longitude !== null)
    .map((sensor) => ({
      id: sensor.id,
      score: sensor.estimate.daysDetecting + 1,
      point: { latitude: sensor.latitude as number, longitude: sensor.longitude as number },
      daysDetecting: sensor.estimate.daysDetecting,
      estimatedHeight: sensor.estimate.estimatedHeight,
    }));
}

export function useRoutePlan(sensors: SensorSummary[]) {
  const [settings, setSettings] = useState<RouteSettings>(loadSettings);
  const [matrix, setMatrix] = useState<RouteMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(ROUTE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const candidates = useMemo(() => toCandidates(sensors), [sensors]);

  const { base } = settings;

  // A matriz depende de rede e só muda quando a base ou o conjunto de
  // candidatos muda. Os outros ajustes (jornada, nº de paradas, tempo de
  // roçada) recalculam o plano sem tocar na API — por isso não entram aqui.
  const matrixKey = useMemo(
    () =>
      base ? [base.latitude, base.longitude, ...candidates.map((c) => c.id)].join("|") : "",
    [base, candidates],
  );

  useEffect(() => {
    if (!base || candidates.length === 0) {
      setMatrix(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const points = [base, ...candidates.map((candidate) => candidate.point)];
        const result = await routeApi.matrix(points);
        if (!cancelled) setMatrix(result);
      } catch (err) {
        if (cancelled) return;
        setMatrix(null);
        setError(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : "Não foi possível calcular os tempos de deslocamento.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // matrixKey resume base + candidatos numa string estável; as dependências
    // reais estão dentro dele.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrixKey]);

  const plan: RoutePlan | null = useMemo(() => {
    if (!matrix || candidates.length === 0) return null;
    return planMowingRoute({
      durations: matrix.durations,
      candidates,
      targetStops: settings.targetStops,
      workdaySeconds: settings.workdayHours * 3600,
      serviceSeconds: settings.serviceMinutes * 60,
    });
  }, [matrix, candidates, settings.targetStops, settings.workdayHours, settings.serviceMinutes]);

  const update = useCallback(
    (patch: Partial<RouteSettings>) => setSettings((current) => ({ ...current, ...patch })),
    [],
  );

  return {
    settings,
    update,
    candidates,
    plan,
    /** Como os tempos foram obtidos — a tela avisa quando é só estimativa. */
    matrixSource: matrix?.source ?? null,
    loading,
    error,
  };
}
