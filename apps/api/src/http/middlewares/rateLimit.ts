import type { MiddlewareHandler } from "hono";
import { log } from "../../infrastructure/providers/logger";
import { fail } from "../response";

const WINDOW_MS = 60_000;

// 100/min era baixo demais para um painel: uma única visita à tela de gráficos
// já dispara 1 + N requisições, e o preflight de CORS dobrava a conta. Ao
// estourar, TODA rota passava a responder 429 pelo resto do minuto — inclusive
// o login, o que aparecia como "a API parou de responder".
const DEFAULT_MAX_REQUESTS = 600;

const MAX_REQUESTS = Number(
    process.env.RATE_LIMIT_PER_MINUTE ?? DEFAULT_MAX_REQUESTS,
);

// Contador em memória por IP. Some quando o processo reinicia e não é
// compartilhado entre instâncias — suficiente para o porte deste serviço.
const hits = new Map<string, { count: number; windowStart: number }>();

// Sem isso o mapa cresce para sempre em um servidor de vida longa: um IP que
// apareceu uma vez nunca era removido.
function limparExpirados(now: number) {
    for (const [ip, entry] of hits) {
        if (now - entry.windowStart > WINDOW_MS) hits.delete(ip);
    }
}

export function rateLimit(): MiddlewareHandler {
    return async (c, next) => {
        // Preflight de CORS é o navegador pedindo permissão, não uso da API —
        // cobrá-lo do usuário fazia cada POST/PATCH custar duas requisições.
        if (c.req.method === "OPTIONS") {
            await next();
            return;
        }

        const ip =
            c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
            c.env?.requestIP?.(c.req.raw)?.address ??
            "desconhecido";

        const now = Date.now();
        if (hits.size > 1000) limparExpirados(now);

        const entry = hits.get(ip);
        if (!entry || now - entry.windowStart > WINDOW_MS) {
            hits.set(ip, { count: 1, windowStart: now });
        } else {
            entry.count++;
        }

        const atual = hits.get(ip)!;
        if (atual.count > MAX_REQUESTS) {
            const segundosRestantes = Math.max(
                1,
                Math.ceil((atual.windowStart + WINDOW_MS - now) / 1000),
            );
            log.warn(
                "ratelimit",
                `IP ${ip} excedeu ${MAX_REQUESTS} req/min — bloqueado por mais ${segundosRestantes}s (ajuste RATE_LIMIT_PER_MINUTE se for uso legítimo)`,
            );
            // Retry-After deixa explícito quanto falta, em vez de o cliente
            // ficar adivinhando por que tudo virou erro de repente.
            c.header("Retry-After", String(segundosRestantes));
            return fail(
                c,
                `Muitas requisições. Tente novamente em ${segundosRestantes}s.`,
                429,
            );
        }

        await next();
    };
}
