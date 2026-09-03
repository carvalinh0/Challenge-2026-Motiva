import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import type { MeshGateway } from "../../../domain/repositories/MeshGateway";
import { canReceiveMeshCommand } from "../../../domain/entities/Sensor";
import type { CalibrationResultDTO } from "../../dtos/mesh.dto";
import {
    MeshTimeoutError,
    NotFoundError,
    UnprocessableError,
} from "../../errors/ApplicationError";

export class RequestNodeCalibrationUseCase {
    constructor(
        private readonly sensors: SensorRepository,
        private readonly mesh: MeshGateway,
    ) {}

    async execute(id: string): Promise<CalibrationResultDTO> {
        const sensor = await this.sensors.findById(id);
        if (!sensor) throw new NotFoundError("Sensor não encontrado");
        if (!canReceiveMeshCommand(sensor)) {
            throw new UnprocessableError(
                "sensor sem node_id configurado, nao e possivel acionar via mesh",
            );
        }

        try {
            // Sem timeout explícito: usa o default de CALIBRATE do gateway
            // (~240s) — a calibração varre o range inteiro nas duas direções.
            const result = await this.mesh.requestFromNode(sensor.nodeId!, "CALIBRATE");
            return { id: sensor.id, ok: result.result === 1 };
        } catch (err) {
            throw new MeshTimeoutError((err as Error).message);
        }
    }
}
