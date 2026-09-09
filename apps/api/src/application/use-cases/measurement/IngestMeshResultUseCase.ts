import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import type { MeasurementRepository } from "../../../domain/repositories/MeasurementRepository";
import type { MeshResult } from "../../../domain/repositories/MeshGateway";
import { MESH_RESULT_BUSY } from "../../../domain/repositories/MeshGateway";
import type { Sensor } from "../../../domain/entities/Sensor";
import { PROXY_NODE_ID } from "../../../domain/entities/Sensor";

export interface IngestLogger {
    info(scope: string, message: string): void;
    warn(scope: string, message: string): void;
}

/**
 * Persiste QUALQUER resultado que apareça na mesh, inclusive os que ninguém
 * pediu — um sensor comum reporta sozinho ao acordar pelo timer (WAKE_TIMER no
 * firmware). Este use case é assinado no gateway na subida da aplicação e vive
 * enquanto o processo viver; sem ele, só as medições pedidas sob demanda pela
 * API seriam gravadas e o histórico nunca cresceria sozinho.
 */
export class IngestMeshResultUseCase {
    constructor(
        private readonly sensors: SensorRepository,
        private readonly measurements: MeasurementRepository,
        private readonly logger: IngestLogger,
    ) {}

    async execute(result: MeshResult): Promise<void> {
        // `sourceNode` é o id do sensor: desde que id e node_id viraram a mesma
        // coisa, não há tradução no meio — e portanto não há como divergirem.
        const sensor =
            (await this.sensors.findById(result.sourceNode)) ??
            (await this.autoRegister(result.sourceNode));

        if (!sensor) return; // não deu pra cadastrar; autoRegister já avisou

        if (result.action === "MEASURE") {
            if (result.result === MESH_RESULT_BUSY) {
                this.logger.info(
                    "mesh",
                    `sensor=${sensor.id} recusou a medicao (ocupado com outra varredura)`,
                );
            } else {
                await this.measurements.create(sensor.id, result.result);
                this.logger.info(
                    "mesh",
                    `medicao persistida: sensor=${sensor.id} value=${result.result}`,
                );
            }
        }

        // Qualquer resposta (MEASURE/HEALTHCHECK/CALIBRATE) prova que o nó está
        // vivo — last_seen sobe sempre, não só em medição. Vale inclusive para
        // a recusa por ocupado: recusar exige estar de pé.
        await this.sensors.touchLastSeen(sensor.id);
    }

    // Cadastra sozinho um nó que apareceu na mesh sem estar na lista.
    private async autoRegister(nodeId: number): Promise<Sensor | null> {
        // node_id 0 é reservado ao proxy no firmware (MESH_PROXY_NODE_ID), e a
        // API guarda proxy e sensor na mesma tabela, separados por `type`.
        const isProxy = nodeId === PROXY_NODE_ID;

        try {
            const sensor = await this.sensors.create({
                id: nodeId,
                name: `Nó ${nodeId} (cadastro automático)`,
                type: isProxy ? "proxy" : "sensor",
            });

            this.logger.info(
                "mesh",
                `${isProxy ? "proxy" : "sensor"} ${nodeId} cadastrado automaticamente — falta informar latitude/longitude`,
            );
            return sensor;
        } catch (err) {
            const existing = await this.sensors.findById(nodeId);
            if (existing) return existing;

            this.logger.warn(
                "mesh",
                `falha ao cadastrar automaticamente o no ${nodeId}: ${(err as Error).message}`,
            );
            return null;
        }
    }
}
