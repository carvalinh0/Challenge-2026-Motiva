import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import type { MeasurementRepository } from "../../../domain/repositories/MeasurementRepository";
import { isActive, isWithinRadius } from "../../../domain/entities/Sensor";
import { consecutiveHighDays } from "../../../domain/entities/Measurement";
import type { Measurement } from "../../../domain/entities/Measurement";
import {
    type ListSensorsQueryDTO,
    type SensorSummaryDTO,
    toSensorSummaryDTO,
} from "../../dtos/sensor.dto";

// Janela de histórico buscada para calcular a prioridade de roçada. Cobre
// com folga o horizonte que consecutiveHighDays consegue enxergar.
const STREAK_WINDOW_MS = 61 * 24 * 60 * 60 * 1000;

export class ListSensorsUseCase {
    constructor(
        private readonly sensors: SensorRepository,
        private readonly measurements: MeasurementRepository,
        private readonly activeWindowMs: number,
    ) {}

    async execute(query: ListSensorsQueryDTO): Promise<SensorSummaryDTO[]> {
        let result = await this.sensors.findAll();

        if (query.proxy) {
            result = result.filter((s) => s.proxyId === query.proxy);
        }

        if (query.closeTo) {
            // O schema já garante o formato "lat,lng".
            const [latStr, lonStr] = query.closeTo.split(",");
            const lat = Number(latStr);
            const lon = Number(lonStr);
            result = result.filter((s) => isWithinRadius(s, lat, lon, query.radius));
        }

        // active e lost são complementares; pedir os dois juntos é sempre vazio,
        // e é isso mesmo que deve acontecer.
        if (query.active) {
            result = result.filter((s) => isActive(s, this.activeWindowMs));
        }
        if (query.lost) {
            result = result.filter((s) => !isActive(s, this.activeWindowMs));
        }

        const historyBySensor = await this.recentHistory();

        return Promise.all(
            result.map(async (sensor) =>
                toSensorSummaryDTO(
                    sensor,
                    await this.measurements.findLastBySensor(sensor.id),
                    isActive(sensor, this.activeWindowMs),
                    consecutiveHighDays(historyBySensor.get(sensor.id) ?? []),
                ),
            ),
        );
    }

    /** Histórico recente de todos os sensores, agrupado por sensor. */
    private async recentHistory(): Promise<Map<number, Measurement[]>> {
        const since = new Date(Date.now() - STREAK_WINDOW_MS);
        const grouped = new Map<number, Measurement[]>();

        for (const measurement of await this.measurements.findAllSince(since)) {
            const list = grouped.get(measurement.sensorId);
            if (list) list.push(measurement);
            else grouped.set(measurement.sensorId, [measurement]);
        }

        return grouped;
    }
}
