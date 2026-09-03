import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import type { MeshGateway } from "../../../domain/repositories/MeshGateway";
import { canReceiveMeshCommand } from "../../../domain/entities/Sensor";
import type { HealthcheckResultDTO } from "../../dtos/mesh.dto";
import { NotFoundError, UnprocessableError } from "../../errors/ApplicationError";

export class RequestNodeHealthcheckUseCase {
    constructor(
        private readonly sensors: SensorRepository,
        private readonly mesh: MeshGateway,
    ) {}

    async execute(id: string): Promise<HealthcheckResultDTO> {
        const sensor = await this.sensors.findById(id);
        if (!sensor) throw new NotFoundError("Sensor não encontrado");
        if (!canReceiveMeshCommand(sensor)) {
            throw new UnprocessableError(
                "sensor sem node_id configurado, nao e possivel acionar via mesh",
            );
        }

        // Timeout aqui não é erro: "não respondeu" é exatamente o que
        // alive:false comunica.
        try {
            await this.mesh.requestFromNode(sensor.nodeId!, "HEALTHCHECK");
            return { id: sensor.id, alive: true };
        } catch {
            return { id: sensor.id, alive: false };
        }
    }
}
