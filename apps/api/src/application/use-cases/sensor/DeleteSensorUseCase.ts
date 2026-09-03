import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import { NotFoundError } from "../../errors/ApplicationError";

export class DeleteSensorUseCase {
    constructor(private readonly sensors: SensorRepository) {}

    // As medições somem junto por cascade no schema — não precisa apagar à mão.
    async execute(id: string): Promise<void> {
        const deleted = await this.sensors.delete(id);
        if (!deleted) throw new NotFoundError("Sensor não encontrado");
    }
}
