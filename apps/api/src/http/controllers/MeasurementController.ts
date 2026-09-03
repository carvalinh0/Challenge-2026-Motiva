import type { Context } from "hono";
import type { AddMeasurementUseCase } from "../../application/use-cases/measurement/AddMeasurementUseCase";
import type { AddBulkMeasurementsUseCase } from "../../application/use-cases/measurement/AddBulkMeasurementsUseCase";
import {
    addMeasurementSchema,
    bulkMeasurementsSchema,
} from "../../application/dtos/measurement.dto";
import { param, validateBody } from "../middlewares/validate";
import { noContent, ok } from "../response";

export class MeasurementController {
    constructor(
        private readonly addMeasurement: AddMeasurementUseCase,
        private readonly addBulk: AddBulkMeasurementsUseCase,
    ) {}

    add = async (c: Context) => {
        const body = await validateBody(c, addMeasurementSchema);
        await this.addMeasurement.execute(param(c, "id"), body);
        return noContent(c);
    };

    addBulkMeasurements = async (c: Context) => {
        const body = await validateBody(c, bulkMeasurementsSchema);
        const { failed } = await this.addBulk.execute(body);

        // 203 sinaliza sucesso parcial: o device deve cadastrar os ids que
        // faltam e reenviar só esses.
        if (failed.length > 0) {
            return ok(
                c,
                { failed },
                "As medições foram adicionadas com sucesso, mas alguns sensores não foram encontrados. Envie-os novamente com o status 204.",
                203,
            );
        }
        return noContent(c);
    };
}
