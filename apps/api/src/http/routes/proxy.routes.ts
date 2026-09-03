import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { ProxyController } from "../controllers/ProxyController";

export function proxyRoutes(controller: ProxyController, jwtOnly: MiddlewareHandler) {
    const routes = new Hono();

    routes.post("/:id", jwtOnly, controller.create);
    routes.get("/:id", jwtOnly, controller.get);
    routes.delete("/:id", jwtOnly, controller.delete);
    routes.post("/:id/reset", jwtOnly, controller.reset);

    return routes;
}
