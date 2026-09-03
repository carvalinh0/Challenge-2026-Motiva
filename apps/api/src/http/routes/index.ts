import { Hono } from "hono";
import type { AuthController } from "../controllers/AuthController";
import type { SensorController } from "../controllers/SensorController";
import type { MeasurementController } from "../controllers/MeasurementController";
import type { ProxyController } from "../controllers/ProxyController";
import type { MeshController } from "../controllers/MeshController";
import type { RouteController } from "../controllers/RouteController";
import type { StatusController } from "../controllers/StatusController";
import type { JwtProvider } from "../../infrastructure/providers/JwtProvider";
import {
    requireDeviceTokenOrJwt,
    requireJwt,
    requireJwtAllowingQuery,
} from "../middlewares/auth";
import { requireConfig } from "../middlewares/requireConfig";
import { authRoutes } from "./auth.routes";
import { sensorRoutes } from "./sensors.routes";
import { proxyRoutes } from "./proxy.routes";
import { meshRoutes } from "./mesh.routes";
import { routeRoutes } from "./route.routes";

export interface Controllers {
    auth: AuthController;
    sensor: SensorController;
    measurement: MeasurementController;
    proxy: ProxyController;
    route: RouteController;
    mesh: MeshController;
    status: StatusController;
}

export interface RouteDeps {
    controllers: Controllers;
    jwt: JwtProvider;
    deviceToken: string | undefined;
    configErrors: string[];
}

export function buildRoutes({
    controllers,
    jwt,
    deviceToken,
    configErrors,
}: RouteDeps) {
    const api = new Hono();

    const jwtOnly = requireJwt(jwt);
    const deviceOrJwt = requireDeviceTokenOrJwt(jwt, deviceToken);
    const jwtOrQuery = requireJwtAllowingQuery(jwt);

    // Sem autenticação de propósito: é o endpoint que se consulta justamente
    // quando algo está errado, inclusive o próprio login. Não expõe dado
    // nenhum além de "está de pé?".
    api.get("/status", controllers.status.get);

    // Tudo abaixo depende de credenciais configuradas. Com config incompleta,
    // respondem 503 dizendo o que falta — só /api/status fica de fora, que é
    // justamente onde se descobre o problema.
    api.use("*", requireConfig(configErrors));

    api.route("/auth", authRoutes(controllers.auth, jwtOnly));
    // Ordem importa: as rotas de mesh registram caminhos mais específicos
    // (/sensors/:id/healthcheck) que colidiriam com os genéricos de sensor.
    api.route("/", meshRoutes(controllers.mesh, jwtOnly, jwtOrQuery));
    api.route("/", sensorRoutes(controllers.sensor, controllers.measurement, jwtOnly, deviceOrJwt));
    api.route("/proxy", proxyRoutes(controllers.proxy, jwtOnly));
    api.route("/route", routeRoutes(controllers.route, jwtOnly));

    return api;
}
