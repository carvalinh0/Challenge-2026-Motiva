import type { MiddlewareHandler } from "hono";
import { log } from "../../infrastructure/providers/logger";

// Uma linha por requisição, sempre — inclusive 401/403/404, que antes eram
// completamente mudas e tornavam impossível debugar pelo terminal.
export function requestLogger(): MiddlewareHandler {
    return async (c, next) => {
        const start = performance.now();
        const ip =
            c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
            c.env?.requestIP?.(c.req.raw)?.address ??
            "desconhecido";

        await next();

        const url = new URL(c.req.url);
        log.request(
            c.req.method,
            url.pathname + url.search,
            c.res.status,
            performance.now() - start,
            ip,
        );
    };
}
