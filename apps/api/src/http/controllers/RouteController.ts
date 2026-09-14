import type { Context } from "hono";
import type { GetRouteMatrixUseCase } from "../../application/use-cases/route/GetRouteMatrixUseCase";
import type { GetRouteGeometryUseCase } from "../../application/use-cases/route/GetRouteGeometryUseCase";
import type { DefineRouteUseCase } from "../../application/use-cases/route/DefineRouteUseCase";
import type { CompleteRouteUseCase } from "../../application/use-cases/route/CompleteRouteUseCase";
import type { GetActiveRouteUseCase } from "../../application/use-cases/route/GetActiveRouteUseCase";
import { defineRouteSchema } from "../../application/dtos/route.dto";
import {
  routeGeometrySchema,
  routeMatrixSchema,
} from "../../application/dtos/route.dto";
import { validateBody } from "../middlewares/validate";
import { idParam } from "../middlewares/validate";
import { ok } from "../response";

export class RouteController {
  constructor(
    private readonly getRouteMatrix: GetRouteMatrixUseCase,
    private readonly getRouteGeometry: GetRouteGeometryUseCase,
    private readonly defineRoute: DefineRouteUseCase,
    private readonly completeRoute: CompleteRouteUseCase,
    private readonly getActiveRoute: GetActiveRouteUseCase,
  ) {}

  matrix = async (c: Context) => {
    const body = await validateBody(c, routeMatrixSchema);
    return ok(c, await this.getRouteMatrix.execute(body));
  };

  geometry = async (c: Context) => {
    const body = await validateBody(c, routeGeometrySchema);
    return ok(c, await this.getRouteGeometry.execute(body));
  };

  define = async (c: Context) => {
    const body = await validateBody(c, defineRouteSchema);
    return ok(
      c,
      await this.defineRoute.execute(body, c.get("username") ?? "equipe"),
    );
  };

  complete = async (c: Context) =>
    ok(
      c,
      await this.completeRoute.execute(
        idParam(c, "id"),
        c.get("username") ?? "equipe",
      ),
    );

  active = async (c: Context) =>
    ok(c, await this.getActiveRoute.execute(c.get("username") ?? "equipe"));
}
