import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import { isProxy } from "../../../domain/entities/Sensor";
import { NotFoundError } from "../../errors/ApplicationError";

export class DeleteProxyUseCase {
    constructor(private readonly sensors: SensorRepository) {}

    // Os sensores filhos não são apagados junto: o schema usa SET NULL no
    // proxy_id, então eles ficam órfãos até serem reapontados a outro proxy.
    async execute(id: string): Promise<void> {
        const proxy = await this.sensors.findById(id);
        if (!proxy || !isProxy(proxy)) {
            throw new NotFoundError("Proxy não encontrado");
        }
        await this.sensors.delete(id);
    }
}
