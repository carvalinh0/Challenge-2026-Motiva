import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import type { MeshGateway } from "../../../domain/repositories/MeshGateway";
import { canReceiveMeshCommand } from "../../../domain/entities/Sensor";
import {
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
    ) {}

    async execute(id: string): Promise<number> {
        const sensor = await this.sensors.findById(id);
        if (!sensor) throw new NotFoundError("Sensor não encontrado");
        if (!canReceiveMeshCommand(sensor)) {
            throw new UnprocessableError(
                "sensor sem node_id configurado, nao e possivel acionar via mesh",
            );
        }

        try {
            const result = await this.mesh.requestFromNode(sensor.nodeId!, "MEASURE");
            return result.result;
        } catch (err) {
            throw new MeshTimeoutError((err as Error).message);
        }
    }
}
