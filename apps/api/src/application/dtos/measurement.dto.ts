import { z } from "zod";
import { MEASUREMENT_VALUE } from "../../domain/entities/Measurement";

// 0/1/2 — os mesmos códigos que o firmware emite. Rejeitar qualquer outro
// valor aqui evita gravar lixo que depois ninguém sabe interpretar.
const measurementValue = z.union([
    z.literal(MEASUREMENT_VALUE.BELOW_LIMIT),
    z.literal(MEASUREMENT_VALUE.ABOVE_LIMIT),
    z.literal(MEASUREMENT_VALUE.UNRELIABLE),
]);

export const addMeasurementSchema = z.object({
    value: measurementValue,
});
export type AddMeasurementDTO = z.infer<typeof addMeasurementSchema>;

export const bulkMeasurementsSchema = z.object({
    data: z
        .array(
            z.object({
                id: z.number().int().min(0).max(65535),
                value: measurementValue,
            }),
        )
        .min(1),
});
export type BulkMeasurementsDTO = z.infer<typeof bulkMeasurementsSchema>;

export interface BulkMeasurementsResultDTO {
    /** Ids que não existem no banco — o device deve cadastrá-los e reenviar. */
    failed: number[];
}
