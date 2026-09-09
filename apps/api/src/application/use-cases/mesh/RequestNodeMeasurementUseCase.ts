import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import type { MeshGateway } from "../../../domain/repositories/MeshGateway";
import type { MeshCommandRegistry } from "../../services/MeshCommandRegistry";
import { MESH_RESULT_BUSY } from "../../../domain/repositories/MeshGateway";
import {
    ConflictError,
    MeshTimeoutError,
    NotFoundError,
    UnprocessableError,
} from "../../errors/ApplicationError";

// Aciona uma medição real (MQTT -> proxy -> LoRa -> sensor) e devolve o valor.
// A gravação no banco acontece pelo listener global (IngestMeshResultUseCase),
// não aqui — senão a mesma medição entraria duas vezes.
export class RequestNodeMeasurementUseCase {
    constructor(
        private readonly sensors: SensorRepository,
        private readonly mesh: MeshGateway,
        private readonly inFlight: MeshCommandRegistry,
    ) {}

    async execute(id: number): Promise<number> {
        const sensor = await this.sensors.findById(id);
        if (!sensor) throw new NotFoundError("Sensor não encontrado");
        if (!this.inFlight.begin(sensor.id, "MEASURE")) {
            const running = this.inFlight.current(sensor.id);
            throw new ConflictError(
                `já existe um ${running} em andamento neste nó; aguarde o resultado ou tente de novo em instantes`,
            );
        }

        let result;
        try {
            result = await this.mesh.requestFromNode(sensor.id, "MEASURE");
        } catch (err) {
            throw new MeshTimeoutError((err as Error).message);
        } finally {
            this.inFlight.end(sensor.id);
        }

        if (result.result === MESH_RESULT_BUSY) {
            throw new ConflictError(
                "sensor ocupado com outra varredura (medicao ou calibracao); tente novamente em instantes",
            );
        }

        return result.result;
    }
}
