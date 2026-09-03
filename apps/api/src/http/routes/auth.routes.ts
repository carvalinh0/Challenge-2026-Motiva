import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { AuthController } from "../controllers/AuthController";

export function authRoutes(controller: AuthController, jwtOnly: MiddlewareHandler) {
    const routes = new Hono();

    // Única rota pública da API — é ela que emite o token.
    routes.post("/login", controller.authenticate);
    routes.get("/me", jwtOnly, controller.me);

    return routes;
}
