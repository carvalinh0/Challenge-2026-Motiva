import { Hono } from "hono";
import { cors } from "hono/cors";
import { buildRoutes, type RouteDeps } from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { rateLimit } from "./middlewares/rateLimit";
import { requestLogger } from "./middlewares/requestLogger";

export function createApp(deps: RouteDeps) {
    const app = new Hono();

    app.onError(errorHandler);
    app.notFound(notFoundHandler);

    app.use("*", requestLogger());
    // CORS liberado: rate limit + credencial já protegem as rotas, e isso
    // permite testar direto do navegador de qualquer origem.
    app.use(
        "*",
        cors({
            origin: "*",
            allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
            allowHeaders: ["Content-Type", "Authorization"],
        }),
    );
    app.use("*", rateLimit());

    // Raiz sempre 200, sem autenticação e sem tocar o banco.
    //
    // Health check de PaaS costuma apontar para "/" por padrão; devolvendo 404
    // ali, a plataforma marca o deploy como não saudável e simplesmente PARA
    // de rotear tráfego — o processo continua vivo nos logs enquanto a borda
    // devolve 502. Um 200 barato aqui elimina essa classe de falha.
    app.get("/", (c) =>
        c.json({
            status: "success",
            data: { name: "api-sensores", docs: "/api/status" },
        }),
    );

    app.route("/api", buildRoutes(deps));

    return app;
}
