import type { MiddlewareHandler } from "hono";
import type { JwtProvider } from "../../infrastructure/providers/JwtProvider";
import { fail } from "../response";

// Dois esquemas de autenticação convivem de propósito:
//
//  - JWT (Bearer <jwt>): usuários do site, emitido por POST /api/auth/login.
//  - Token estático (Bearer <TOKEN>): sensores/proxies que fazem push de
//    medição por HTTP. Hardware em campo não tem como fazer login nem renovar
//    token, então continua com o segredo fixo do .env.
//
// O README distingue 401 (sem credencial) de 403 (credencial inválida).

declare module "hono" {
    interface ContextVariableMap {
        /** Preenchido só quando a requisição veio autenticada por JWT. */
        username?: string;
    }
}

function extractBearer(header: string | undefined): string | null {
    if (!header) return null;
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1]!.trim() : null;
}

/** Exige um JWT válido. Usado nas rotas de gestão/leitura do site. */
export function requireJwt(jwt: JwtProvider): MiddlewareHandler {
    return async (c, next) => {
        const token = extractBearer(c.req.header("Authorization"));
        if (!token) return fail(c, "Não autenticado", 401);

        try {
            const payload = await jwt.verify(token);
            c.set("username", payload.sub);
        } catch {
            return fail(c, "Não autorizado", 403);
        }

        await next();
    };
}

/**
 * Aceita o token estático de device OU um JWT válido. As rotas de ingestão de
 * medição usam isto para que o site também consiga chamá-las durante testes,
 * sem precisar do segredo dos devices.
 */
export function requireDeviceTokenOrJwt(
    jwt: JwtProvider,
    deviceToken: string | undefined,
): MiddlewareHandler {
    return async (c, next) => {
        const token = extractBearer(c.req.header("Authorization"));
        if (!token) return fail(c, "Não autenticado", 401);

        if (deviceToken && token === deviceToken) {
            await next();
            return;
        }

        try {
            const payload = await jwt.verify(token);
            c.set("username", payload.sub);
        } catch {
            return fail(c, "Não autorizado", 403);
        }

        await next();
    };
}

/**
 * Variante para SSE: o EventSource nativo do navegador não manda header
 * Authorization, então aqui o token também pode vir por query string.
 */
export function requireJwtAllowingQuery(jwt: JwtProvider): MiddlewareHandler {
    return async (c, next) => {
        const token =
            extractBearer(c.req.header("Authorization")) ?? c.req.query("token") ?? null;
        if (!token) return fail(c, "Não autenticado", 401);

        try {
            const payload = await jwt.verify(token);
            c.set("username", payload.sub);
        } catch {
            return fail(c, "Não autorizado", 403);
        }

        await next();
    };
}
