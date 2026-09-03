import { useCallback, useState } from "react";
import { ApiError } from "@/lib/httpClient";
import { useAuth } from "@/features/auth";
import { sensorsApi } from "../api/sensorsApi";
import { nivelFromValue } from "@/utils/sensorStatus";
import type { SensorSummary } from "@/types/sensor";
import type { FeedbackMessage, SensorAction } from "../types";

/**
 * Ações por nó (mesh e CRUD). Centraliza o padrão comum: marcar qual ação
 * está rodando em qual nó, traduzir o resultado em mensagem e recarregar a
 * lista no fim — com ou sem sucesso.
 */
export function useSensorActions(reload: () => Promise<void>) {
  const { logout } = useAuth();
  const [running, setRunning] = useState<Record<string, SensorAction>>({});
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);

  const run = useCallback(
    async <T>(
      sensorId: string,
      action: SensorAction,
      fn: () => Promise<T>,
      successMessage: (result: T) => string,
    ) => {
      setRunning((current) => ({ ...current, [sensorId]: action }));
      setFeedback(null);
      try {
        const result = await fn();
        setFeedback({ tone: "success", text: successMessage(result) });
        await reload();
      } catch (err) {
        if (err instanceof ApiError && err.isAuthError) logout();
        else {
          setFeedback({
            tone: "error",
            text: `${sensorId}: ${err instanceof Error ? err.message : "erro inesperado"}`,
          });
        }
      } finally {
        setRunning((current) => {
          const next = { ...current };
          delete next[sensorId];
          return next;
        });
      }
    },
    [logout, reload],
  );

  const measure = useCallback(
    (sensor: SensorSummary) =>
      run(
        sensor.id,
        "measure",
        () => sensorsApi.measureNow(sensor.id),
        (value) => `${sensor.id} mediu: ${nivelFromValue(value)}.`,
      ),
    [run],
  );

  const healthcheck = useCallback(
    (sensor: SensorSummary) =>
      run(
        sensor.id,
        "health",
        () => sensorsApi.healthcheck(sensor.id),
        (result) => `${sensor.id} está ${result?.alive ? "vivo" : "sem resposta"}.`,
      ),
    [run],
  );

  const calibrate = useCallback(
    (sensor: SensorSummary) =>
      run(
        sensor.id,
        "calibrate",
        () => sensorsApi.calibrate(sensor.id),
        (result) =>
          `Calibração de ${sensor.id} ${result?.ok ? "concluída" : "falhou"}.`,
      ),
    [run],
  );

  const remove = useCallback(
    (sensor: SensorSummary) => {
      // Apagar é destrutivo e não tem desfazer — confirma antes.
      if (!window.confirm(`Excluir "${sensor.id}" e todas as suas medições?`)) return;
      return run(
        sensor.id,
        "delete",
        () =>
          sensor.type === "proxy"
            ? sensorsApi.removeProxy(sensor.id)
            : sensorsApi.remove(sensor.id),
        () => `"${sensor.id}" excluído.`,
      );
    },
    [run],
  );

  const reset = useCallback(
    (sensor: SensorSummary) => {
      if (!window.confirm(`Resetar "${sensor.id}"? As medições serão apagadas.`)) return;
      return run(
        sensor.id,
        "reset",
        () =>
          sensor.type === "proxy"
            ? sensorsApi.resetProxy(sensor.id)
            : sensorsApi.reset(sensor.id),
        () => `"${sensor.id}" resetado.`,
      );
    },
    [run],
  );

  return {
    running,
    feedback,
    setFeedback,
    measure,
    healthcheck,
    calibrate,
    remove,
    reset,
  };
}
