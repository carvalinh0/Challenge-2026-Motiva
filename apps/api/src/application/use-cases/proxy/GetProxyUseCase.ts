import type { SensorRepository } from "../../../domain/repositories/SensorRepository";
import type { MeasurementRepository } from "../../../domain/repositories/MeasurementRepository";
import { isActive, isProxy } from "../../../domain/entities/Sensor";
import {
    type ProxyDetailDTO,
    toSensorDetailDTO,
    toSensorSummaryDTO,
} from "../../dtos/sensor.dto";
import { NotFoundError } from "../../errors/ApplicationError";

const PROXY_HISTORY_LIMIT = 90;

export class GetProxyUseCase {
    constructor(
        private readonly sensors: SensorRepository,
        private readonly measurements: MeasurementRepository,
        private readonly activeWindowMs: number,
    ) {}

    async execute(id: number): Promise<ProxyDetailDTO> {
        const proxy = await this.sensors.findById(id);
        if (!proxy || !isProxy(proxy)) {
            throw new NotFoundError("Proxy não encontrado");
        }

        const history = await this.measurements.findLatestBySensor(
            id,
            PROXY_HISTORY_LIMIT,
        );
        const children = await this.sensors.findByProxyId(id);

        return {
            ...toSensorDetailDTO(proxy, history),
            sensors: await Promise.all(
                children.map(async (sensor) =>
                    toSensorSummaryDTO(
                        sensor,
                        await this.measurements.findLastBySensor(sensor.id),
                        isActive(sensor, this.activeWindowMs),
                    ),
                ),
            ),
        };
    }
}
