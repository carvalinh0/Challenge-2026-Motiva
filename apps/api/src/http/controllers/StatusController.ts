import type { Context } from "hono";
import type { SensorRepository } from "../../domain/repositories/SensorRepository";
import type { MeshGateway } from "../../domain/repositories/MeshGateway";
import { log } from "../../infrastructure/providers/logger";
import { ok } from "../response";

// Quanto esperar pelo banco antes de declarar que ele não está respondendo.
// Sem esse teto, um banco travado faria o próprio diagnóstico travar junto —
// que é exatamente o sintoma que este endpoint existe para explicar.
const DB_TIMEOUT_MS = 5000;

/**
 * Diagnóstico sem autenticação: diz o que está de pé e o que não está.
 *
 * Existe porque "o login funciona mas criar sensor não responde" é ambíguo —
 * o login é a única rota que NÃO toca o banco, então esse par de sintomas
 * aponta para a camada de dados, e não para o processo. Aqui isso vira uma
 * resposta objetiva em uma requisição só.
 */
export class StatusController {
    constructor(
        private readonly sensors: SensorRepository,
        private readonly mesh: MeshGateway,
        /** Variáveis de ambiente faltando, detectadas na subida (ver main.ts). */
        private readonly configErrors: string[] = [],
    ) {}

    get = async (c: Context) => {
        const inicio = performance.now();
        let database: { ok: boolean; latencyMs?: number; error?: string };

        try {
            await Promise.race([
                this.sensors.findAll(),
                new Promise((_, reject) =>
                    setTimeout(
                        () => reject(new Error(`sem resposta em ${DB_TIMEOUT_MS}ms`)),
                        DB_TIMEOUT_MS,
                    ),
                ),
            ]);
            database = {
                ok: true,
                latencyMs: Number((performance.now() - inicio).toFixed(1)),
            };
        } catch (err) {
            database = { ok: false, error: (err as Error).message };
            log.error("status", "banco nao respondeu ao diagnostico", err);
        }

        return ok(c, {
            server: "ok",
            // Vazio = tudo configurado. Com itens aqui, as demais rotas
            // respondem 503 com o mesmo motivo.
            config: { ok: this.configErrors.length === 0, problems: this.configErrors },
            database,
            mqtt: { connected: this.mesh.isConnected() },
            uptimeSeconds: Math.floor(process.uptime()),
        });
    };
}
