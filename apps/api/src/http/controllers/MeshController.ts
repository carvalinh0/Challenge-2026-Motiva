import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { RequestNodeMeasurementUseCase } from "../../application/use-cases/mesh/RequestNodeMeasurementUseCase";
import type { RequestNodeHealthcheckUseCase } from "../../application/use-cases/mesh/RequestNodeHealthcheckUseCase";
import type { RequestNodeCalibrationUseCase } from "../../application/use-cases/mesh/RequestNodeCalibrationUseCase";
import type { BroadcastHealthcheckUseCase } from "../../application/use-cases/mesh/BroadcastHealthcheckUseCase";
import type { BroadcastMeasurementUseCase } from "../../application/use-cases/mesh/BroadcastMeasurementUseCase";
import type { MeshGateway } from "../../domain/repositories/MeshGateway";
import { log } from "../../infrastructure/providers/logger";
import { param } from "../middlewares/validate";
import { ok } from "../response";

const SSE_KEEPALIVE_MS = 15_000;

export class MeshController {
    constructor(
        private readonly requestMeasurement: RequestNodeMeasurementUseCase,
        private readonly requestHealthcheck: RequestNodeHealthcheckUseCase,
        private readonly requestCalibration: RequestNodeCalibrationUseCase,
        private readonly broadcastHealthcheck: BroadcastHealthcheckUseCase,
        private readonly broadcastMeasurement: BroadcastMeasurementUseCase,
        private readonly mesh: MeshGateway,
    ) {}

    measure = async (c: Context) =>
        ok(c, await this.requestMeasurement.execute(param(c, "id")));

    healthcheck = async (c: Context) =>
        ok(c, await this.requestHealthcheck.execute(param(c, "id")));

    calibrate = async (c: Context) =>
        ok(c, await this.requestCalibration.execute(param(c, "id")));

    healthBroadcast = async (c: Context) =>
        ok(c, { status: await this.broadcastHealthcheck.execute() });

    measurementBroadcast = async (c: Context) =>
        ok(c, { measurements: await this.broadcastMeasurement.execute() });

    /**
     * SSE: repassa ao vivo tudo que chega da mesh, inclusive o que ninguém
     * pediu (ciclo autônomo do sensor), para o site não precisar dar poll.
     */
    events = async (c: Context) =>
        streamSSE(c, async (stream) => {
            log.info("sse", "cliente conectado em /api/events");

            const unsubscribe = this.mesh.subscribe((result) => {
                void stream.writeSSE({ data: JSON.stringify(result) });
            });

            stream.onAbort(() => {
                log.info("sse", "cliente desconectado de /api/events");
                unsubscribe();
            });

            // Mantém o stream vivo enquanto o cliente estiver conectado; sem
            // isso o handler retornaria e o Hono fecharia a conexão na hora.
            while (!stream.closed && !stream.aborted) {
                await stream.sleep(SSE_KEEPALIVE_MS);
                await stream.writeSSE({ data: "", event: "ping" });
            }

            unsubscribe();
        });
}
