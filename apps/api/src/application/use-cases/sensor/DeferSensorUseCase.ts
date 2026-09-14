import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import {
  NotFoundError,
  UnprocessableError,
} from "../../errors/ApplicationError";

export class DeferSensorUseCase {
  constructor(private readonly sensors: SensorRepository) {}

  async execute(id: number): Promise<void> {
    const sensor = await this.sensors.findById(id);
    if (!sensor) {
      throw new NotFoundError("Sensor não encontrado");
    }
    if (sensor.routeId !== null) {
      throw new UnprocessableError(
        "Este sensor já está reservado por uma rota ativa.",
      );
    }
    await this.sensors.defer(id);
  }
}
