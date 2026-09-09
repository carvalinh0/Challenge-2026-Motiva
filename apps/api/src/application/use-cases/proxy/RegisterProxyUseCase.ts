import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import { PROXY_NODE_ID } from "../../../domain/entities/Sensor";
import type { CreateProxyDTO } from "../../dtos/sensor.dto";
import { ConflictError, UnprocessableError } from "../../errors/ApplicationError";

export class RegisterProxyUseCase {
    constructor(private readonly sensors: SensorRepository) {}

    async execute(id: number, data: CreateProxyDTO): Promise<void> {
        if (id !== PROXY_NODE_ID) {
            throw new UnprocessableError(
                `o id do proxy deve ser ${PROXY_NODE_ID} (MESH_PROXY_NODE_ID no firmware)`,
            );
        }

        if (await this.sensors.findById(id)) {
            throw new ConflictError("O proxy já existe");
        }

        await this.sensors.create({
            id,
            name: data.name ?? null,
            latitude: data.latitude ?? null,
            longitude: data.longitude ?? null,
            type: "proxy",
        });
    }
}
