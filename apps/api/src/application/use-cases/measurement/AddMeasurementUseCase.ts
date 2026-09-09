import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import type { MeasurementRepository } from "../../../domain/repositories/MeasurementRepository";
import type { AddMeasurementDTO } from "../../dtos/measurement.dto";
import { NotFoundError } from "../../errors/ApplicationError";

// Push direto por HTTP: o device já calculou o valor e chama a API sem passar
// pela mesh. O caminho MQTT tem seu próprio use case (IngestMeshResultUseCase).
export class AddMeasurementUseCase {
    constructor(
        private readonly sensors: SensorRepository,
        private readonly measurements: MeasurementRepository,
    ) {}

    async execute(sensorId: number, data: AddMeasurementDTO): Promise<void> {
        const sensor = await this.sensors.findById(sensorId);
        if (!sensor) throw new NotFoundError("Sensor não encontrado");

        await this.measurements.create(sensorId, data.value);
        await this.sensors.touchLastSeen(sensorId);
    }
}
