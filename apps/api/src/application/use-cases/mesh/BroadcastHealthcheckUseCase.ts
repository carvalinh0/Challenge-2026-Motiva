import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import type { MeshGateway } from "../../../domain/repositories/MeshGateway";
import type { MeshNodeStatusDTO } from "../../dtos/mesh.dto";
import { ServiceUnavailableError } from "../../errors/ApplicationError";

// Pede pra mesh inteira responder de uma vez (comando sem targetNode), junta o
// que chegar na janela e cruza com os nós cadastrados: quem não respondeu sai
// como alive:false.
export class BroadcastHealthcheckUseCase {
    constructor(
        private readonly sensors: SensorRepository,
        private readonly mesh: MeshGateway,
    ) {}

    async execute(): Promise<MeshNodeStatusDTO[]> {
        if (!this.mesh.isConnected()) {
            throw new ServiceUnavailableError("MQTT nao conectado");
        }

        const results = await this.mesh.broadcast("HEALTHCHECK");
        const answered = new Set(results.map((r) => r.sourceNode));

        const nodes = await this.sensors.findAllWithNodeId();
        return nodes.map((sensor) => ({
            id: sensor.id,
            node_id: sensor.nodeId!,
            alive: answered.has(sensor.nodeId!),
        }));
    }
}
