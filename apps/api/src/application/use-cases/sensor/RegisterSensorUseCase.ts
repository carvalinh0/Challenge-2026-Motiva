import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import { isProxy } from "../../../domain/entities/Sensor";
import type { CreateSensorDTO } from "../../dtos/sensor.dto";
import { ConflictError, UnprocessableError } from "../../errors/ApplicationError";

export class RegisterSensorUseCase {
    constructor(private readonly sensors: SensorRepository) {}

    async execute(id: string, data: CreateSensorDTO): Promise<void> {
        if (await this.sensors.findById(id)) {
            throw new ConflictError("O sensor já existe");
        }

        // node_id é único na mesh: dois nós com o mesmo id tornariam
        // impossível saber de quem veio uma medição chegando por MQTT.
        if (data.node_id != null) {
            const taken = await this.sensors.findByNodeId(data.node_id);
            if (taken) {
                throw new ConflictError(
                    `node_id ${data.node_id} já está em uso pelo sensor "${taken.id}"`,
                );
            }
        }

        // Sem esta checagem, um proxy_id inexistente só falhava lá no banco,
        // como violação de chave estrangeira — que virava 500 "Erro interno",
        // sem dizer ao usuário que bastava cadastrar o proxy antes.
        if (data.proxy_id != null) {
            await this.assertProxyExists(data.proxy_id);
        }

        await this.sensors.create({
            id,
            name: data.name ?? null,
            latitude: data.latitude ?? null,
            longitude: data.longitude ?? null,
            proxyId: data.proxy_id ?? null,
            nodeId: data.node_id ?? null,
            type: "sensor",
        });
    }

    private async assertProxyExists(proxyId: string): Promise<void> {
        const proxy = await this.sensors.findById(proxyId);
        if (!proxy) {
            throw new UnprocessableError(
                `proxy_id "${proxyId}" não existe. Cadastre o proxy antes (POST /api/proxy/${proxyId}) ou deixe o campo vazio.`,
            );
        }
        if (!isProxy(proxy)) {
            throw new UnprocessableError(
                `"${proxyId}" existe, mas é do tipo "${proxy.type}" — proxy_id precisa apontar para um proxy.`,
            );
        }
    }
}
