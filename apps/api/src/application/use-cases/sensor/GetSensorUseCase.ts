import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import type { MeasurementRepository } from "../../../domain/repositories/MeasurementRepository";
import { type SensorDetailDTO, toSensorDetailDTO } from "../../dtos/sensor.dto";
import { NotFoundError } from "../../errors/ApplicationError";

export class GetSensorUseCase {
    constructor(
        private readonly sensors: SensorRepository,
        private readonly measurements: MeasurementRepository,
    ) {}

    async execute(id: string, measurementLimit: number): Promise<SensorDetailDTO> {
        const sensor = await this.sensors.findById(id);
        if (!sensor) throw new NotFoundError("Sensor não encontrado");

        const history = await this.measurements.findLatestBySensor(id, measurementLimit);
        return toSensorDetailDTO(sensor, history);
    }
}
