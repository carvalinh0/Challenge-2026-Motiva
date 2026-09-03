import type { Context } from "hono";
import type { GetRouteMatrixUseCase } from "../../application/use-cases/route/GetRouteMatrixUseCase";
import { routeMatrixSchema } from "../../application/dtos/route.dto";
import { validateBody } from "../middlewares/validate";
import { ok } from "../response";

export class RouteController {
    constructor(private readonly getRouteMatrix: GetRouteMatrixUseCase) {}

    matrix = async (c: Context) => {
        const body = await validateBody(c, routeMatrixSchema);
        return ok(c, await this.getRouteMatrix.execute(body));
    };
}
