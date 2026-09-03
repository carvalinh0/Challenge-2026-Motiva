import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import type { MeasurementRepository } from "../../../domain/repositories/MeasurementRepository";
import { NotFoundError } from "../../errors/ApplicationError";

export class ResetSensorUseCase {
    constructor(
        private readonly sensors: SensorRepository,
        private readonly measurements: MeasurementRepository,
    ) {}

    async execute(id: string): Promise<void> {
        const sensor = await this.sensors.findById(id);
        if (!sensor) throw new NotFoundError("Sensor não encontrado");

        await this.measurements.deleteBySensor(id);
        await this.sensors.delete(id);
    }
}
