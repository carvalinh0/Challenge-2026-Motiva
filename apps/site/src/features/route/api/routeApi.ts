import { request } from "@/lib/httpClient";
import type { GeoPoint, RouteMatrix } from "@/types/sensor";

export const routeApi = {
  /**
   * Matriz de tempos entre os pontos, na ordem enviada. Quem fala com o OSRM
   * é a API — daqui o site só recebe segundos.
   */
  matrix: (points: GeoPoint[]) =>
    request<RouteMatrix>("/api/route/matrix", {
      method: "POST",
      body: { points },
    }),

  geometry: (points: GeoPoint[]) =>
    request<{ points: GeoPoint[] }>("/api/route/geometry", {
      method: "POST",
      body: { points },
    }),

  define: (sensorIds: number[], base: GeoPoint) =>
    request<DefinedRoute>("/api/route/define", {
      method: "POST",
      body: { sensorIds, base },
    }),

  complete: (routeId: number) =>
    request<DefinedRoute>(`/api/route/${routeId}/complete`, { method: "POST" }),

  active: () => request<DefinedRoute>("/api/route/active"),
};

export interface DefinedRoute {
  id: number;
  status: "defined" | "completed";
  sensorIds: number[];
  createdBy: string;
  createdAt: number;
  completedAt: number | null;
  base: GeoPoint;
}
