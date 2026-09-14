import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import type { MeasurementRepository } from "../../../domain/repositories/MeasurementRepository";
import { isActive } from "../../../domain/entities/Sensor";
import { consecutiveHighDays } from "../../../domain/entities/Measurement";
import {
  type ListSensorsPageQueryDTO,
  type SensorPageOutputDTO,
  toSensorSummaryDTO,
} from "../../dtos/sensor.dto";

const ACTIVE_WINDOW_MS = 48 * 60 * 60 * 1000;
const STREAK_WINDOW_MS = 61 * 24 * 60 * 60 * 1000;

export class ListSensorsPageUseCase {
  constructor(
    private readonly sensors: SensorRepository,
    private readonly measurements: MeasurementRepository,
    private readonly activeWindowMs = ACTIVE_WINDOW_MS,
  ) {}

  async execute(query: ListSensorsPageQueryDTO): Promise<SensorPageOutputDTO> {
    const now = Date.now();
    const page = await this.sensors.findPage({
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      type: query.type,
      name: query.name,
      activeSince: query.active
        ? new Date(now - this.activeWindowMs)
        : undefined,
      inactiveBefore: query.lost
        ? new Date(now - this.activeWindowMs)
        : undefined,
      createdFrom: query.createdFrom
        ? new Date(`${query.createdFrom}T00:00:00`)
        : undefined,
      createdTo: query.createdTo
        ? new Date(`${query.createdTo}T23:59:59.999`)
        : undefined,
    });
    const ids = page.items.map((sensor) => sensor.id);
    const latest = await this.measurements.findLatestBySensors(ids, 1);
    const historyRows = await this.measurements.findAllSinceForSensors(
      new Date(now - STREAK_WINDOW_MS),
      ids,
    );
    const history = new Map<number, typeof historyRows>();
    for (const row of historyRows) {
      const rows = history.get(row.sensorId) ?? [];
      rows.push(row);
      history.set(row.sensorId, rows);
    }
    const items = page.items.map((sensor) =>
      toSensorSummaryDTO(
        sensor,
        latest.get(sensor.id)?.[0] ?? null,
        isActive(sensor, this.activeWindowMs),
        consecutiveHighDays(history.get(sensor.id) ?? []),
      ),
    );
    return {
      items,
      page: query.page,
      limit: query.limit,
      total: page.total,
      totalPages: Math.max(1, Math.ceil(page.total / query.limit)),
    };
  }
}
