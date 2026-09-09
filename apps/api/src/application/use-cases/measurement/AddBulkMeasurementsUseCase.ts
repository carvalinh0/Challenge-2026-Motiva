import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import type { MeasurementRepository } from "../../../domain/repositories/MeasurementRepository";
import type {
    BulkMeasurementsDTO,
    BulkMeasurementsResultDTO,
} from "../../dtos/measurement.dto";

export class AddBulkMeasurementsUseCase {
    constructor(
        private readonly sensors: SensorRepository,
        private readonly measurements: MeasurementRepository,
    ) {}

    // Sucesso parcial é esperado aqui: grava tudo que dá e devolve a lista dos
    // ids desconhecidos, para o device cadastrá-los e reenviar só esses.
    async execute(data: BulkMeasurementsDTO): Promise<BulkMeasurementsResultDTO> {
        const failed: number[] = [];

        for (const item of data.data) {
            const sensor = await this.sensors.findById(item.id);
            if (!sensor) {
                failed.push(item.id);
                continue;
            }
            await this.measurements.create(item.id, item.value);
            await this.sensors.touchLastSeen(item.id);
        }

        return { failed };
    }
}
