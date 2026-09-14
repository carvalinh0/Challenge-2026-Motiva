import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { SensorController } from "../controllers/SensorController";
import type { MeasurementController } from "../controllers/MeasurementController";

export function sensorRoutes(
  sensor: SensorController,
  measurement: MeasurementController,
  jwtOnly: MiddlewareHandler,
  deviceOrJwt: MiddlewareHandler,
) {
  const routes = new Hono();

  // Rotas fixas antes das paramétricas: "/sensors/measurements" não pode
  // ser capturada por "/sensors/:id".
  routes.post(
    "/sensors/measurements",
    deviceOrJwt,
    measurement.addBulkMeasurements,
  );

  routes.get("/sensors", jwtOnly, sensor.list);
  routes.get("/sensors/page", jwtOnly, sensor.page);
  routes.get("/sensors/readings-summary", jwtOnly, sensor.readingsSummary);
  routes.get("/sensors/history", jwtOnly, sensor.history);
  routes.post("/sensors/:id/defer", jwtOnly, sensor.defer);

  routes.post("/sensors/:id", jwtOnly, sensor.create);
  routes.get("/sensors/:id", jwtOnly, sensor.get);
  routes.patch("/sensors/:id", jwtOnly, sensor.update);
  routes.delete("/sensors/:id", jwtOnly, sensor.delete);
  routes.post("/sensors/:id/reset", jwtOnly, sensor.reset);

  // Push direto do device (sem passar pela mesh) — aceita o token estático.
  routes.post("/sensors/:id/measurement", deviceOrJwt, measurement.add);

  return routes;
}
