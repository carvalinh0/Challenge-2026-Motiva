import { request } from "@/lib/httpClient";
import type { GeoPoint, RouteMatrix } from "@/types/sensor";

export const routeApi = {
  /**
   * Matriz de tempos entre os pontos, na ordem enviada. Quem fala com o OSRM
   * é a API — daqui o site só recebe segundos.
   */
  matrix: (points: GeoPoint[]) =>
    request<RouteMatrix>("/api/route/matrix", { method: "POST", body: { points } }),
};
