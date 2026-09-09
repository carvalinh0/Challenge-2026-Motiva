import type { Measurement } from "../../domain/entities/Measurement";
import type { MeasurementRepository } from "../../domain/repositories/MeasurementRepository";
import { prisma } from "./prisma";

export class PrismaMeasurementRepository implements MeasurementRepository {
    async create(sensorId: number, value: number): Promise<Measurement> {
        return prisma.measurement.create({ data: { sensorId, value } });
    }

    async findLatestBySensor(sensorId: number, limit: number): Promise<Measurement[]> {
        return prisma.measurement.findMany({
            where: { sensorId },
            orderBy: { timestamp: "desc" },
            take: limit,
        });
    }

    async findLastBySensor(sensorId: number): Promise<Measurement | null> {
        return prisma.measurement.findFirst({
            where: { sensorId },
            orderBy: { timestamp: "desc" },
        });
    }

    async findAllSince(since: Date): Promise<Measurement[]> {
        return prisma.measurement.findMany({
            where: { timestamp: { gte: since } },
            orderBy: { timestamp: "desc" },
        });
    }

    async deleteBySensor(sensorId: number): Promise<void> {
        await prisma.measurement.deleteMany({ where: { sensorId } });
    }
}
