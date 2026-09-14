import type { Context } from "hono";
import type { RegisterSensorUseCase } from "../../application/use-cases/sensor/RegisterSensorUseCase";
import type { GetSensorUseCase } from "../../application/use-cases/sensor/GetSensorUseCase";
import type { GetSensorsHistoryUseCase } from "../../application/use-cases/sensor/GetSensorsHistoryUseCase";
import type { DeferSensorUseCase } from "../../application/use-cases/sensor/DeferSensorUseCase";
import type { UpdateSensorUseCase } from "../../application/use-cases/sensor/UpdateSensorUseCase";
import type { DeleteSensorUseCase } from "../../application/use-cases/sensor/DeleteSensorUseCase";
import type { ListSensorsUseCase } from "../../application/use-cases/sensor/ListSensorsUseCase";
import type { ListSensorsPageUseCase } from "../../application/use-cases/sensor/ListSensorsPageUseCase";
import type { GetReadingsSummaryUseCase } from "../../application/use-cases/sensor/GetReadingsSummaryUseCase";
import type { ResetSensorUseCase } from "../../application/use-cases/sensor/ResetSensorUseCase";
import {
  createSensorSchema,
  getSensorQuerySchema,
  listSensorsQuerySchema,
  listSensorsPageQuerySchema,
  readingsSummaryQuerySchema,
  updateSensorSchema,
} from "../../application/dtos/sensor.dto";
import { idParam, validateBody, validateQuery } from "../middlewares/validate";
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
    private readonly listSensorsPage: ListSensorsPageUseCase,
    private readonly getReadingsSummary: GetReadingsSummaryUseCase,
    private readonly resetSensor: ResetSensorUseCase,
    private readonly getSensorsHistory: GetSensorsHistoryUseCase,
    private readonly deferSensor: DeferSensorUseCase,
  ) {}

  create = async (c: Context) => {
    const body = await validateBody(c, createSensorSchema);
    await this.registerSensor.execute(idParam(c), body);
    return ok(c, undefined, "Sensor criado com sucesso", 201);
  };

  get = async (c: Context) => {
    const { measurements } = validateQuery(c, getSensorQuerySchema);
    const sensor = await this.getSensor.execute(idParam(c), measurements);
    return ok(c, sensor);
  };

  update = async (c: Context) => {
    const body = await validateBody(c, updateSensorSchema);
    const sensor = await this.updateSensor.execute(idParam(c), body);
    return ok(c, {
      id: sensor.id,
      latitude: sensor.latitude,
      longitude: sensor.longitude,
      type: sensor.type,
    });
  };

  delete = async (c: Context) => {
    await this.deleteSensor.execute(idParam(c));
    return ok(c);
  };

  list = async (c: Context) => {
    const query = validateQuery(c, listSensorsQuerySchema);
    return ok(c, await this.listSensors.execute(query));
  };

  page = async (c: Context) => {
    const query = validateQuery(c, listSensorsPageQuerySchema);
    return ok(c, await this.listSensorsPage.execute(query));
  };

  readingsSummary = async (c: Context) => {
    const query = validateQuery(c, readingsSummaryQuerySchema);
    return ok(c, await this.getReadingsSummary.execute(query));
  };

  history = async (c: Context) => {
    const { measurements } = validateQuery(c, getSensorQuerySchema);
    return ok(c, await this.getSensorsHistory.execute(measurements));
  };

  defer = async (c: Context) => {
    await this.deferSensor.execute(idParam(c));
    return ok(c, undefined, "Trecho marcado para depois");
  };

  reset = async (c: Context) => {
    await this.resetSensor.execute(idParam(c));
    return ok(c);
  };
}
