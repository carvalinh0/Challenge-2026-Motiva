import { z } from "zod";
import type { RouteMatrix } from "../../domain/repositories/RouteMatrixProvider";

// O /table do OSRM público aceita bem mais que isto, mas a matriz cresce ao
// quadrado e um roteiro de um dia não tem dezenas de paradas candidatas.
const MAX_POINTS = 50;

export const routeMatrixSchema = z.object({
  points: z
    .array(
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      }),
    )
    .min(2, "informe ao menos a base e um destino")
    .max(MAX_POINTS),
});
export type RouteMatrixDTO = z.infer<typeof routeMatrixSchema>;
export const routeGeometrySchema = routeMatrixSchema;
export type RouteGeometryDTO = RouteMatrixDTO;

export interface RouteMatrixOutputDTO {
  /** durations[i][j] em segundos, na mesma ordem dos pontos enviados. */
  durations: number[][];
  source: RouteMatrix["source"];
}

export interface RouteGeometryOutputDTO {
  points: { latitude: number; longitude: number }[];
}

export const defineRouteSchema = z.object({
  sensorIds: z.array(z.number().int().positive()).min(1).max(49),
  base: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
});
export type DefineRouteDTO = z.infer<typeof defineRouteSchema>;

export interface DefinedRouteDTO {
  id: number;
  status: "defined" | "completed";
  sensorIds: number[];
  createdBy: string;
  createdAt: number;
  completedAt: number | null;
  base: { latitude: number; longitude: number };
}
