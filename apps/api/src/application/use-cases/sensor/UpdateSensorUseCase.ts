import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import { isProxy } from "../../../domain/entities/Sensor";
import type { UpdateSensorDTO } from "../../dtos/sensor.dto";
import {
    ConflictError,
    NotFoundError,
    UnprocessableError,
} from "../../errors/ApplicationError";
import type { Sensor } from "../../../domain/entities/Sensor";

export class UpdateSensorUseCase {
    constructor(private readonly sensors: SensorRepository) {}

    async execute(id: string, data: UpdateSensorDTO): Promise<Sensor> {
        const existing = await this.sensors.findById(id);
        if (!existing) throw new NotFoundError("Sensor não encontrado");

        if (data.node_id != null && data.node_id !== existing.nodeId) {
            const taken = await this.sensors.findByNodeId(data.node_id);
            if (taken && taken.id !== id) {
                throw new ConflictError(
                    `node_id ${data.node_id} já está em uso pelo sensor "${taken.id}"`,
                );
            }
        }

        // Mesmo motivo do cadastro: apontar para um proxy inexistente vira
        // violação de chave estrangeira no banco, e o usuário só veria um 500.
        if (data.proxy_id != null) {
            const proxy = await this.sensors.findById(data.proxy_id);
            if (!proxy) {
                throw new UnprocessableError(
                    `proxy_id "${data.proxy_id}" não existe. Cadastre o proxy antes ou deixe o campo vazio.`,
                );
            }
            if (!isProxy(proxy)) {
                throw new UnprocessableError(
                    `"${data.proxy_id}" existe, mas é do tipo "${proxy.type}" — proxy_id precisa apontar para um proxy.`,
                );
            }
        }

        // `undefined` = campo ausente no PATCH (não mexer); `null` = pedido
        // explícito de limpar. O repositório distingue os dois.
        const updated = await this.sensors.update(id, {
            name: data.name,
            latitude: data.latitude,
            longitude: data.longitude,
            type: data.type,
            proxyId: data.proxy_id,
            nodeId: data.node_id,
        });
        if (!updated) throw new NotFoundError("Sensor não encontrado");
        return updated;
    }
}
