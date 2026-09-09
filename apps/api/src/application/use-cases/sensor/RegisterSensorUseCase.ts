import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import { isProxy } from "../../../domain/entities/Sensor";
import type { CreateSensorDTO } from "../../dtos/sensor.dto";
import { ConflictError, UnprocessableError } from "../../errors/ApplicationError";

export class RegisterSensorUseCase {
    constructor(private readonly sensors: SensorRepository) {}

    async execute(id: number, data: CreateSensorDTO): Promise<void> {
        if (await this.sensors.findById(id)) {
            throw new ConflictError(`Já existe um nó cadastrado com o id ${id}`);
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
            type: "sensor",
        });
    }

    private async assertProxyExists(proxyId: number): Promise<void> {
        const proxy = await this.sensors.findById(proxyId);
        if (!proxy) {
            throw new UnprocessableError(
                `proxy_id ${proxyId} não existe. Cadastre o proxy antes (POST /api/proxy/${proxyId}) ou deixe o campo vazio.`,
            );
        }
        if (!isProxy(proxy)) {
            throw new UnprocessableError(
                `O nó ${proxyId} existe, mas é do tipo "${proxy.type}" — proxy_id precisa apontar para um proxy.`,
            );
        }
    }
}
