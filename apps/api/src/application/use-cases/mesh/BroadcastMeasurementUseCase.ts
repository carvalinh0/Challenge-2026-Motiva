import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import type { MeshGateway } from "../../../domain/repositories/MeshGateway";
import type { MeshNodeMeasurementDTO } from "../../dtos/mesh.dto";
import { ServiceUnavailableError } from "../../errors/ApplicationError";

// Igual ao broadcast de healthcheck, mas pedindo MEASURE. A gravação fica por
// conta do listener global (IngestMeshResultUseCase); aqui só se monta a
// resposta com quem respondeu dentro da janela.
export class BroadcastMeasurementUseCase {
    constructor(
        private readonly sensors: SensorRepository,
        private readonly mesh: MeshGateway,
    ) {}

    async execute(): Promise<MeshNodeMeasurementDTO[]> {
        if (!this.mesh.isConnected()) {
            throw new ServiceUnavailableError("MQTT nao conectado");
        }

        const results = await this.mesh.broadcast("MEASURE");
        const byNode = new Map(results.map((r) => [r.sourceNode, r]));

        const nodes = await this.sensors.findAllWithNodeId();
        return nodes.map((sensor) => ({
            id: sensor.id,
            node_id: sensor.nodeId!,
            value: byNode.get(sensor.nodeId!)?.result ?? null,
        }));
    }
}
