import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import {
    ConflictError,
    MeshTimeoutError,
    NotFoundError,
    ServiceUnavailableError,
    UnauthenticatedError,
    UnauthorizedError,
    UnprocessableError,
} from "../../application/errors/ApplicationError";
import { log } from "../../infrastructure/providers/logger";
import { fail } from "../response";

// Único lugar que traduz erro de domínio/aplicação para status HTTP. Os use
// cases não sabem o que é HTTP; quem sabe é aqui.
function statusFor(err: Error): number | null {
    if (err instanceof NotFoundError) return 404;
    if (err instanceof ConflictError) return 409;
    if (err instanceof UnprocessableError) return 422;
    if (err instanceof UnauthenticatedError) return 401;
    if (err instanceof UnauthorizedError) return 403;
    if (err instanceof MeshTimeoutError) return 504;
    if (err instanceof ServiceUnavailableError) return 503;
    return null;
}

export const errorHandler: ErrorHandler = (err, c) => {
    if (err instanceof ZodError) {
        const detail = err.issues
            .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
            .join("; ");
        return fail(c, `Dados inválidos — ${detail}`, 400);
    }

    const status = statusFor(err);
    if (status) return fail(c, err.message, status);

    if (err instanceof HTTPException) {
        // Corpo malformado e afins: o Hono lança isso antes de chegar no handler.
        if (err.status === 400) return fail(c, "Corpo da requisição inválido", 400);
        return fail(c, err.message, err.status);
    }

    // Qualquer coisa não prevista: loga com stack e devolve o mesmo envelope do
    // resto da API, em vez de vazar detalhe interno.
    log.error("http", `${c.req.method} ${new URL(c.req.url).pathname} lancou uma excecao nao tratada`, err);
    return fail(c, "Erro interno do servidor", 500);
};

export const notFoundHandler: NotFoundHandler = (c: Context) => fail(c, "Not Found", 404);
