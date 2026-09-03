import type { Context } from "hono";
import type { RegisterSensorUseCase } from "../../application/use-cases/sensor/RegisterSensorUseCase";
import type { GetSensorUseCase } from "../../application/use-cases/sensor/GetSensorUseCase";
import type { UpdateSensorUseCase } from "../../application/use-cases/sensor/UpdateSensorUseCase";
import type { DeleteSensorUseCase } from "../../application/use-cases/sensor/DeleteSensorUseCase";
import type { ListSensorsUseCase } from "../../application/use-cases/sensor/ListSensorsUseCase";
import type { ResetSensorUseCase } from "../../application/use-cases/sensor/ResetSensorUseCase";
import {
    createSensorSchema,
    getSensorQuerySchema,
    listSensorsQuerySchema,
    updateSensorSchema,
} from "../../application/dtos/sensor.dto";
import { param, validateBody, validateQuery } from "../middlewares/validate";
import { ok } from "../response";

// Controllers só traduzem HTTP <-> use case: validam a entrada, chamam o caso
// de uso e formatam a saída. Nenhuma regra de negócio mora aqui.
export class SensorController {
    constructor(
        private readonly registerSensor: RegisterSensorUseCase,
        private readonly getSensor: GetSensorUseCase,
        private readonly updateSensor: UpdateSensorUseCase,
        private readonly deleteSensor: DeleteSensorUseCase,
        private readonly listSensors: ListSensorsUseCase,
        private readonly resetSensor: ResetSensorUseCase,
    ) {}

    create = async (c: Context) => {
        const body = await validateBody(c, createSensorSchema);
        await this.registerSensor.execute(param(c, "id"), body);
        return ok(c, undefined, "Sensor criado com sucesso", 201);
    };

    get = async (c: Context) => {
        const { measurements } = validateQuery(c, getSensorQuerySchema);
        const sensor = await this.getSensor.execute(param(c, "id"), measurements);
        return ok(c, sensor);
    };

    update = async (c: Context) => {
        const body = await validateBody(c, updateSensorSchema);
        const sensor = await this.updateSensor.execute(param(c, "id"), body);
        return ok(c, {
            id: sensor.id,
            latitude: sensor.latitude,
            longitude: sensor.longitude,
            type: sensor.type,
            node_id: sensor.nodeId,
        });
    };

    delete = async (c: Context) => {
        await this.deleteSensor.execute(param(c, "id"));
        return ok(c);
    };

    list = async (c: Context) => {
        const query = validateQuery(c, listSensorsQuerySchema);
        return ok(c, await this.listSensors.execute(query));
    };

    reset = async (c: Context) => {
        await this.resetSensor.execute(param(c, "id"));
        return ok(c);
    };
}
