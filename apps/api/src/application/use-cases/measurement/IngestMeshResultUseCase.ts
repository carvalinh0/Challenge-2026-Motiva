import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import type { MeasurementRepository } from "../../../domain/repositories/MeasurementRepository";
import type { MeshResult } from "../../../domain/repositories/MeshGateway";

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
        const sensor = await this.sensors.findByNodeId(result.sourceNode);
        if (!sensor) {
            // Sem esse aviso, um nó respondendo com node_id não cadastrado
            // simplesmente sumiria: nenhuma medição, nenhum erro, nada.
            this.logger.warn(
                "mesh",
                `resultado de sourceNode=${result.sourceNode} ignorado: nenhum sensor cadastrado com esse node_id`,
            );
            return;
        }

        if (result.action === "MEASURE") {
            await this.measurements.create(sensor.id, result.result);
            this.logger.info(
                "mesh",
                `medicao persistida: sensor=${sensor.id} value=${result.result}`,
            );
        }

        // Qualquer resposta (MEASURE/HEALTHCHECK/CALIBRATE) prova que o nó está
        // vivo — last_seen sobe sempre, não só em medição.
        await this.sensors.touchLastSeen(sensor.id);
    }
}
