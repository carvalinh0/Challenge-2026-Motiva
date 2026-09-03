import type { MiddlewareHandler } from "hono";
import { fail } from "../response";

/**
 * Barra as rotas que dependem de configuração ausente, com 503 e o motivo.
 *
 * Existe para que uma variável de ambiente esquecida vire uma resposta que
 * explica o problema, em vez de derrubar o processo — o que em produção
 * aparecia como 502 (e, no navegador, como erro de CORS, porque a página de
 * erro do proxy não carrega os cabeçalhos).
 */
export function requireConfig(problems: string[]): MiddlewareHandler {
    return async (c, next) => {
        if (problems.length > 0) {
            return fail(
                c,
                `API mal configurada: ${problems.join(" ")} Veja GET /api/status.`,
                503,
            );
        }
        await next();
    };
}
