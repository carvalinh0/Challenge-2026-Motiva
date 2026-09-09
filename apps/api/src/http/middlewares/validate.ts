import type { Context } from "hono";
import { z } from "zod";
import type { ZodType } from "zod";
import { MAX_NODE_ID } from "../../domain/entities/Sensor";

// Validação explícita, chamada pelos controllers. O ZodError que escapa daqui
// é traduzido para 400 pelo errorHandler, então não há try/catch repetido em
// cada rota.

export async function validateBody<T>(c: Context, schema: ZodType<T>): Promise<T> {
    // Body ausente/vazio vira {} para o Zod reportar campos faltando em vez de
    // estourar um erro de parse cru.
    const raw = await c.req.json().catch(() => ({}));
    return schema.parse(raw);
}

export function validateQuery<T>(c: Context, schema: ZodType<T>): T {
    return schema.parse(c.req.query());
}

/**
 * `c.req.param()` é tipado como `string | undefined` porque o Context genérico
 * não conhece o path da rota. O parâmetro sempre existe (a rota só casa com
 * ele presente), então isso estreita o tipo num lugar só, em vez de espalhar
 * `!` por todos os controllers.
 */
export function param(c: Context, name: string): string {
    const value = c.req.param(name);
    if (value === undefined) {
        throw new Error(`parametro de rota "${name}" ausente`);
    }
    return value;
}

const sensorIdSchema = z.coerce
    .number({ message: "id do nó deve ser um número inteiro (o NODE_ID da mesh)" })
    .int()
    .min(0)
    .max(MAX_NODE_ID);

export function idParam(c: Context, name = "id"): number {
    return sensorIdSchema.parse(param(c, name));
}
