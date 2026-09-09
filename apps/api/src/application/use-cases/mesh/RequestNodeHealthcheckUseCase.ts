import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import type { MeshGateway } from "../../../domain/repositories/MeshGateway";
import type { MeshCommandRegistry } from "../../services/MeshCommandRegistry";
import type { HealthcheckResultDTO } from "../../dtos/mesh.dto";
import { ConflictError, NotFoundError } from "../../errors/ApplicationError";

export class RequestNodeHealthcheckUseCase {
    constructor(
        private readonly sensors: SensorRepository,
        private readonly mesh: MeshGateway,
        private readonly inFlight: MeshCommandRegistry,
    ) {}

    async execute(id: number): Promise<HealthcheckResultDTO> {
        const sensor = await this.sensors.findById(id);
        if (!sensor) throw new NotFoundError("Sensor não encontrado");
        if (!this.inFlight.begin(sensor.id, "HEALTHCHECK")) {
            const running = this.inFlight.current(sensor.id);
            throw new ConflictError(
                `já existe um ${running} em andamento neste nó; aguarde o resultado ou tente de novo em instantes`,
            );
        }

        // Timeout aqui não é erro: "não respondeu" é exatamente o que
        // alive:false comunica.
        try {
            await this.mesh.requestFromNode(sensor.id, "HEALTHCHECK");
            return { id: sensor.id, alive: true };
        } catch {
            return { id: sensor.id, alive: false };
        } finally {
            this.inFlight.end(sensor.id);
        }
    }
}
