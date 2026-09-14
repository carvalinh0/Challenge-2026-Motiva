import type { MeasurementRepository } from "../../../domain/repositories/MeasurementRepository";
import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import { type SensorDetailDTO, toSensorDetailDTO } from "../../dtos/sensor.dto";

export class GetSensorsHistoryUseCase {
  constructor(
    private readonly sensors: SensorRepository,
    private readonly measurements: MeasurementRepository,
  ) {}

  async execute(measurementLimit: number): Promise<SensorDetailDTO[]> {
    const sensors = await this.sensors.findAll();
    const history = await this.measurements.findLatestBySensors(
      sensors.map((sensor) => sensor.id),
      measurementLimit,
    );
    return sensors.map((sensor) =>
      toSensorDetailDTO(sensor, history.get(sensor.id) ?? []),
    );
  }
}
