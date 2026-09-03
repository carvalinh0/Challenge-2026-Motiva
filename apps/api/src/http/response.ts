import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

// Envelope {status, message?, data?} em TODA resposta, para bater com o
// contrato documentado no README.

export function ok<T>(c: Context, data?: T, message?: string, status = 200) {
    const body: Record<string, unknown> = { status: "success" };
    if (message !== undefined) body.message = message;
    if (data !== undefined) body.data = data;
    return c.json(body, status as ContentfulStatusCode);
}

export function fail(c: Context, message: string, status = 400) {
    return c.json({ status: "error", message }, status as ContentfulStatusCode);
}

export function noContent(c: Context) {
    return c.body(null, 204);
}
