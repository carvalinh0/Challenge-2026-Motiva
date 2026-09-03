import { absoluteUrl, request, tokenStorage } from "@/lib/httpClient";
import { sensorsApi } from "@/features/sensors";
import type {
  MeshNodeMeasurement,
  MeshNodeStatus,
  MeshResult,
  SensorSummary,
} from "@/types/sensor";

export const dashboardApi = {
  /**
   * Panorama do dashboard em UMA chamada: a listagem já traz `active` por
   * sensor, então não é preciso uma segunda com ?active=true só para saber
   * quem está perdido.
   */
  overview: async (): Promise<SensorSummary[]> => (await sensorsApi.list()) ?? [],

  /** Healthcheck em broadcast: janela de ~30s enquanto os nós respondem. */
  healthBroadcast: () =>
    request<{ status: MeshNodeStatus[] }>("/api/health", { method: "POST" }),

  /** Medição em broadcast: mesma ideia, mas pedindo MEASURE. */
  measurementBroadcast: () =>
    request<{ measurements: MeshNodeMeasurement[] }>("/api/measurements/broadcast", {
      method: "POST",
    }),
};

/**
 * Stream de eventos da mesh (SSE). O EventSource nativo não manda header
 * Authorization, por isso a API aceita o token por query string nesta rota.
 * Devolve a função de fechar.
 */
export function subscribeToMeshEvents(
  onEvent: (event: MeshResult) => void,
  onError?: (event: Event) => void,
): () => void {
  const token = tokenStorage.get();
  if (!token) return () => {};

  const source = new EventSource(
    absoluteUrl(`/api/events?token=${encodeURIComponent(token)}`),
  );

  source.onmessage = (event: MessageEvent<string>) => {
    try {
      onEvent(JSON.parse(event.data) as MeshResult);
    } catch {
      // "ping" e comentários de keep-alive não são JSON — ignorar é o certo.
    }
  };

  if (onError) source.onerror = onError;

  return () => source.close();
}
