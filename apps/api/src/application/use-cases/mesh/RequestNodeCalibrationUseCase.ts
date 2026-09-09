import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import type { MeshGateway } from "../../../domain/repositories/MeshGateway";
import type { MeshCommandRegistry } from "../../services/MeshCommandRegistry";
import { MESH_RESULT_BUSY } from "../../../domain/repositories/MeshGateway";
import type { CalibrationResultDTO } from "../../dtos/mesh.dto";
import {
    ConflictError,
    MeshTimeoutError,
    NotFoundError,
    UnprocessableError,
} from "../../errors/ApplicationError";

export class RequestNodeCalibrationUseCase {
    constructor(
        private readonly sensors: SensorRepository,
        private readonly mesh: MeshGateway,
        private readonly inFlight: MeshCommandRegistry,
    ) {}

    async execute(id: number): Promise<CalibrationResultDTO> {
        const sensor = await this.sensors.findById(id);
        if (!sensor) throw new NotFoundError("Sensor não encontrado");
        if (!this.inFlight.begin(sensor.id, "CALIBRATE")) {
            const running = this.inFlight.current(sensor.id);
            throw new ConflictError(
                `já existe um ${running} em andamento neste nó; aguarde o resultado ou tente de novo em instantes`,
            );
        }

        try {
            // Sem timeout explícito: usa o default de CALIBRATE do gateway
            // (~240s) — a calibração varre o range inteiro nas duas direções.
            const result = await this.mesh.requestFromNode(sensor.id, "CALIBRATE");

            if (result.result === MESH_RESULT_BUSY) {
                throw new ConflictError(
                    "sensor ocupado com outra varredura; tente novamente em instantes",
                );
            }

            return { id: sensor.id, ok: result.result === 1 };
        } catch (err) {
            if (err instanceof ConflictError) throw err;
            throw new MeshTimeoutError((err as Error).message);
        } finally {
            this.inFlight.end(sensor.id);
        }
    }
}
