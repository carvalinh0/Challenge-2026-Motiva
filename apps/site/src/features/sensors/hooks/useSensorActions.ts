import { useCallback, useState } from "react";
import { ApiError } from "@/lib/httpClient";
import { useAuth } from "@/features/auth";
import { sensorsApi } from "../api/sensorsApi";
import { nivelFromValue } from "@/utils/sensorStatus";
import type { SensorSummary } from "@/types/sensor";
import type { FeedbackMessage, SensorAction } from "../types";
import type { SensorConfirmationAction } from "../components/SensorConfirmationModal";

/**
 * Ações por nó (mesh e CRUD). Centraliza o padrão comum: marcar qual ação
 * está rodando em qual nó, traduzir o resultado em mensagem e recarregar a
 * lista no fim — com ou sem sucesso.
 */
export function useSensorActions(reload: () => Promise<void>) {
  const { logout } = useAuth();
  const [running, setRunning] = useState<Record<string, SensorAction>>({});
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [confirmation, setConfirmation] = useState<{
    action: SensorConfirmationAction;
    sensor: SensorSummary;
  } | null>(null);

  const run = useCallback(
    async <T>(
      sensorId: number,
      action: SensorAction,
      fn: () => Promise<T>,
      successMessage: (result: T) => {
        text: string;
        tone?: "success" | "error";
      },
    ) => {
      setRunning((current) => ({ ...current, [sensorId]: action }));
      setFeedback(null);
      try {
        const result = await fn();
        const { text, tone = "success" } = successMessage(result);
        setFeedback({ tone, text });
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
        (value) => ({
          tone: "success",
          text: `${sensor.name} mediu: ${nivelFromValue(value)}.`,
        }),
      ),
    [run],
  );

  const healthcheck = useCallback(
    (sensor: SensorSummary) =>
      run(
        sensor.id,
        "health",
        () => sensorsApi.healthcheck(sensor.id),
        (result) => ({
          tone: result?.alive ? "success" : "error",
          text: `${sensor.name} está ${result?.alive ? "vivo" : "sem resposta"}.`,
        }),
      ),
    [run],
  );

  const calibrate = useCallback(
    (sensor: SensorSummary) => setConfirmation({ action: "calibrate", sensor }),
    [],
  );

  const remove = useCallback(
    (sensor: SensorSummary) => setConfirmation({ action: "delete", sensor }),
    [],
  );

  const reset = useCallback(
    (sensor: SensorSummary) => setConfirmation({ action: "reset", sensor }),
    [],
  );

  const confirm = useCallback(async () => {
    if (!confirmation) return;
    const { action, sensor } = confirmation;
    setConfirmation(null);

    if (action === "calibrate") {
      await run(
        sensor.id,
        "calibrate",
        () => sensorsApi.calibrate(sensor.id),
        (result) => ({
          tone: result?.ok ? "success" : "error",
          text: `Calibração de ${sensor.name} ${result?.ok ? "concluída" : "falhou"}.`,
        }),
      );
    } else if (action === "reset") {
      await run(
        sensor.id,
        "reset",
        () =>
          sensor.type === "proxy"
            ? sensorsApi.resetProxy(sensor.id)
            : sensorsApi.reset(sensor.id),
        () => ({ tone: "success", text: `"${sensor.name}" resetado.` }),
      );
    } else {
      await run(
        sensor.id,
        "delete",
        () =>
          sensor.type === "proxy"
            ? sensorsApi.removeProxy(sensor.id)
            : sensorsApi.remove(sensor.id),
        () => ({ tone: "success", text: `"${sensor.name}" excluído.` }),
      );
    }
  }, [confirmation, run]);

  return {
    running,
    feedback,
    setFeedback,
    measure,
    healthcheck,
    calibrate,
    remove,
    reset,
    confirmation,
    confirm,
    cancel: () => setConfirmation(null),
  };
}
