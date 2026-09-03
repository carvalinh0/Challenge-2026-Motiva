import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import type { MeasurementRepository } from "../../../domain/repositories/MeasurementRepository";
import { isProxy } from "../../../domain/entities/Sensor";
import { NotFoundError } from "../../errors/ApplicationError";

export class ResetProxyUseCase {
    constructor(
        private readonly sensors: SensorRepository,
        private readonly measurements: MeasurementRepository,
    ) {}

    async execute(id: string): Promise<void> {
        const proxy = await this.sensors.findById(id);
        if (!proxy || !isProxy(proxy)) {
            throw new NotFoundError("Proxy não encontrado");
        }

        await this.measurements.deleteBySensor(id);
        await this.sensors.delete(id);
    }
}
