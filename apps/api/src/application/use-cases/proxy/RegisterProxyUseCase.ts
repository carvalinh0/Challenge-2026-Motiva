import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import { PROXY_NODE_ID } from "../../../domain/entities/Sensor";
import type { CreateProxyDTO } from "../../dtos/sensor.dto";
import { ConflictError, UnprocessableError } from "../../errors/ApplicationError";

export class RegisterProxyUseCase {
    constructor(private readonly sensors: SensorRepository) {}

    async execute(id: string, data: CreateProxyDTO): Promise<void> {
        if (await this.sensors.findById(id)) {
            throw new ConflictError("O proxy já existe");
        }

        // O firmware fixa MESH_PROXY_NODE_ID = 0 para o proxy; aceitar outro
        // valor aqui criaria um cadastro que nunca casaria com o hardware.
        const nodeId = data.node_id ?? PROXY_NODE_ID;
        if (nodeId !== PROXY_NODE_ID) {
            throw new UnprocessableError(
                `node_id do proxy deve ser ${PROXY_NODE_ID} (MESH_PROXY_NODE_ID no firmware)`,
            );
        }

        const taken = await this.sensors.findByNodeId(nodeId);
        if (taken) {
            throw new ConflictError(
                `node_id ${nodeId} já está em uso pelo sensor "${taken.id}"`,
            );
        }

        await this.sensors.create({
            id,
            name: data.name ?? null,
            latitude: data.latitude ?? null,
            longitude: data.longitude ?? null,
            nodeId,
            type: "proxy",
        });
    }
}
