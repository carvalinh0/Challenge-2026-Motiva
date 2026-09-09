import { z } from "zod";
import type { Sensor } from "../../domain/entities/Sensor";
import { MAX_NODE_ID } from "../../domain/entities/Sensor";
import type { Measurement } from "../../domain/entities/Measurement";

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);
const nodeId = z.number().int().min(0).max(MAX_NODE_ID);

export const createSensorSchema = z.object({
    name: z.string().min(1).nullish(),
    latitude: latitude.nullish(),
    longitude: longitude.nullish(),
    proxy_id: nodeId.nullish(),
});
export type CreateSensorDTO = z.infer<typeof createSensorSchema>;

export const updateSensorSchema = z.object({
    name: z.string().min(1).nullish(),
    latitude: latitude.nullish(),
    longitude: longitude.nullish(),
    type: z.enum(["sensor", "proxy"]).optional(),
    proxy_id: nodeId.nullish(),
});
export type UpdateSensorDTO = z.infer<typeof updateSensorSchema>;

export const createProxySchema = z.object({
    name: z.string().min(1).nullish(),
    latitude: latitude.nullish(),
    longitude: longitude.nullish(),
});
export type CreateProxyDTO = z.infer<typeof createProxySchema>;

// Query string chega sempre como texto — daí o coerce e o "true" literal.
export const getSensorQuerySchema = z.object({
    measurements: z.coerce.number().int().positive().max(1000).default(90),
});

export const listSensorsQuerySchema = z.object({
    proxy: z.coerce.number().int().min(0).max(MAX_NODE_ID).optional(),
    active: z
        .enum(["true", "false"])
        .optional()
        .transform((v) => v === "true"),
    lost: z
        .enum(["true", "false"])
        .optional()
        .transform((v) => v === "true"),
    closeTo: z
        .string()
        .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, 'closeTo deve ser "latitude,longitude"')
        .optional(),
    radius: z.coerce.number().positive().default(10),
});
export type ListSensorsQueryDTO = z.infer<typeof listSensorsQuerySchema>;

export interface MeasurementOutputDTO {
    timestamp: number;
    value: number;
}

export interface SensorSummaryDTO {
    id: number;
    latitude: number | null;
    longitude: number | null;
    type: string;
    /** Epoch ms da última vez que o nó deu notícia; null se nunca reportou. */
    last_seen: number | null;
    /** Se `last_seen` está dentro da janela de atividade. Evita que o cliente
     *  precise de uma segunda chamada com ?active=true só para saber isso. */
    active: boolean;
    lastMeasurement: MeasurementOutputDTO | null;
    /**
     * Dias seguidos reportando acima do limite (ver consecutiveHighDays). É a
     * prioridade de roçada: quanto maior, há mais tempo aquele trecho está
     * pedindo corte.
     */
    consecutiveHighDays: number;
}

export interface SensorDetailDTO {
    id: number;
    latitude: number | null;
    longitude: number | null;
    type: string;
    lastMeasurements: MeasurementOutputDTO[];
}

export interface ProxyDetailDTO extends SensorDetailDTO {
    sensors: SensorSummaryDTO[];
}

// Conversão domínio -> saída. Fica junto da definição dos DTOs para que a
// forma da resposta e o código que a produz não saiam de sincronia.

export function toMeasurementDTO(measurement: Measurement): MeasurementOutputDTO {
    return {
        timestamp: measurement.timestamp.getTime(),
        value: measurement.value,
    };
}

export function toSensorSummaryDTO(
    sensor: Sensor,
    lastMeasurement: Measurement | null,
    active = false,
    consecutiveHighDays = 0,
): SensorSummaryDTO {
    return {
        id: sensor.id,
        latitude: sensor.latitude,
        longitude: sensor.longitude,
        type: sensor.type,
        last_seen: sensor.lastSeen ? sensor.lastSeen.getTime() : null,
        active,
        lastMeasurement: lastMeasurement ? toMeasurementDTO(lastMeasurement) : null,
        consecutiveHighDays,
    };
}

export function toSensorDetailDTO(
    sensor: Sensor,
    measurements: Measurement[],
): SensorDetailDTO {
    return {
        id: sensor.id,
        latitude: sensor.latitude,
        longitude: sensor.longitude,
        type: sensor.type,
        lastMeasurements: measurements.map(toMeasurementDTO),
    };
}
