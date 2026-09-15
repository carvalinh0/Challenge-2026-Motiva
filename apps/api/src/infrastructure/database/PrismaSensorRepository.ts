import type { Sensor, SensorType } from "../../domain/entities/Sensor";
import type {
  CreateSensorData,
  SensorPageQuery,
  SensorRepository,
  UpdateSensorData,
} from "../../domain/repositories/SensorRepository";
import {
  ConflictError,
  UnprocessableError,
} from "../../application/errors/ApplicationError";
import { prisma } from "./prisma";

function translatePrismaError(err: unknown): never {
  const code = (err as { code?: string })?.code;

  if (code === "P2003") {
    throw new UnprocessableError(
      "Referência inválida: o proxy_id informado não existe. Cadastre o proxy antes.",
    );
  }
  if (code === "P2002") {
    throw new ConflictError("Já existe um nó cadastrado com esse id.");
  }
  throw err;
}

type SensorRow = {
  id: number;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  type: string;
  proxyId: number | null;
  lastSeen: Date | null;
  deferredAt: Date | null;
  routeId: number | null;
  createdAt: Date;
};

function toDomain(row: SensorRow): Sensor {
  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    type: (row.type === "proxy" ? "proxy" : "sensor") satisfies SensorType,
    proxyId: row.proxyId,
    lastSeen: row.lastSeen,
    deferredAt: row.deferredAt,
    routeId: row.routeId,
    createdAt: row.createdAt,
  };
}

export class PrismaSensorRepository implements SensorRepository {
  async findById(id: number): Promise<Sensor | null> {
    const row = await prisma.sensor.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findAll(): Promise<Sensor[]> {
    const rows = await prisma.sensor.findMany({ orderBy: { id: "asc" } });
    return rows.map(toDomain);
  }

  async findPage(
    input: SensorPageQuery,
  ): Promise<{ items: Sensor[]; total: number }> {
    const where = {
      ...(input.type ? { type: input.type } : {}),
      ...(input.name ? { name: { contains: input.name } } : {}),
      ...(input.activeSince ? { lastSeen: { gte: input.activeSince } } : {}),
      ...(input.inactiveBefore
        ? {
            OR: [
              { lastSeen: null },
              { lastSeen: { lt: input.inactiveBefore } },
            ],
          }
        : {}),
      ...(input.createdFrom || input.createdTo
        ? {
            createdAt: {
              ...(input.createdFrom ? { gte: input.createdFrom } : {}),
              ...(input.createdTo ? { lte: input.createdTo } : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.sensor.findMany({
        where,
        orderBy: { id: "asc" },
        skip: input.skip,
        take: input.take,
      }),
      prisma.sensor.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async findByProxyId(proxyId: number): Promise<Sensor[]> {
    const rows = await prisma.sensor.findMany({
      where: { proxyId },
      orderBy: { id: "asc" },
    });
    return rows.map(toDomain);
  }

  async create(data: CreateSensorData): Promise<Sensor> {
    try {
      const row = await prisma.sensor.create({
        data: {
          id: data.id,
          name: data.name ?? null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          type: data.type ?? "sensor",
          proxyId: data.proxyId ?? null,
        },
      });
      return toDomain(row);
    } catch (err) {
      translatePrismaError(err);
    }
  }

  async update(id: number, data: UpdateSensorData): Promise<Sensor | null> {
    const patch = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    );

    try {
      const row = await prisma.sensor.update({ where: { id }, data: patch });
      return toDomain(row);
    } catch (err) {
      if ((err as { code?: string })?.code === "P2025") return null;
      translatePrismaError(err);
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      await prisma.sensor.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async touchLastSeen(id: number): Promise<void> {
    await prisma.sensor.update({
      where: { id },
      data: { lastSeen: new Date() },
    });
  }

  async defer(id: number): Promise<Sensor | null> {
    try {
      const row = await prisma.sensor.update({
        where: { id },
        data: { deferredAt: new Date() },
      });
      return toDomain(row);
    } catch (err) {
      if ((err as { code?: string })?.code === "P2025") return null;
      throw err;
    }
  }
}
