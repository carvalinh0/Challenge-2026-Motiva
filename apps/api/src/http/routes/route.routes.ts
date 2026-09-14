import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { RouteController } from "../controllers/RouteController";

export function routeRoutes(
  route: RouteController,
  jwtOnly: MiddlewareHandler,
) {
  const routes = new Hono();

  // POST, e não GET, porque a lista de coordenadas não cabe confortavelmente
  // numa query string — e coordenada de operação não deve ir parar em log de
  // acesso nem em histórico de navegador.
  routes.post("/matrix", jwtOnly, route.matrix);
  routes.post("/geometry", jwtOnly, route.geometry);
  routes.post("/define", jwtOnly, route.define);
  routes.get("/active", jwtOnly, route.active);
  routes.post("/:id/complete", jwtOnly, route.complete);

  return routes;
}
