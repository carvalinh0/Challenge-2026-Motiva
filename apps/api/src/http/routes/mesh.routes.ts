import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { MeshController } from "../controllers/MeshController";

// Rotas que acionam a mesh de verdade (API -> MQTT -> proxy -> LoRa -> sensor).
export function meshRoutes(
    controller: MeshController,
    jwtOnly: MiddlewareHandler,
    jwtOrQuery: MiddlewareHandler,
) {
    const routes = new Hono();

    routes.get("/sensors/:id/measurement", jwtOnly, controller.measure);
    routes.get("/sensors/:id/healthcheck", jwtOnly, controller.healthcheck);
    routes.post("/sensors/:id/calibrate", jwtOnly, controller.calibrate);

    routes.post("/health", jwtOnly, controller.healthBroadcast);
    routes.post("/measurements/broadcast", jwtOnly, controller.measurementBroadcast);

    // EventSource do navegador não manda header Authorization — esta rota
    // também aceita ?token=.
    routes.get("/events", jwtOrQuery, controller.events);

    return routes;
}
