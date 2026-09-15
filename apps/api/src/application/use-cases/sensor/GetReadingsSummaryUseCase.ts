import { prisma } from "../../../infrastructure/database/prisma";
import type {
  ReadingsSummaryOutputDTO,
  ReadingsSummaryQueryDTO,
} from "../../dtos/sensor.dto";

export class GetReadingsSummaryUseCase {
  async execute({
    days,
    page,
    limit,
  }: ReadingsSummaryQueryDTO): Promise<ReadingsSummaryOutputDTO> {
    const since = days
      ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      : undefined;
    const where = since ? { timestamp: { gte: since } } : undefined;
    const [sensors, groups, daysRows] = await Promise.all([
      prisma.sensor.findMany({
        where: { type: "sensor" },
        select: { id: true, name: true },
      }),
      prisma.measurement.groupBy({
        by: ["sensorId", "value"],
        where,
        _count: { _all: true },
      }),
      since
        ? prisma.$queryRaw<
            { day: string; total: number; high: number | null }[]
          >`
            SELECT substr(timestamp::text, 1, 10) AS day, COUNT(*) AS total,
                   SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END) AS high
            FROM measurements
            WHERE timestamp >= ${since.toISOString()}
            GROUP BY substr(timestamp::text, 1, 10)
            ORDER BY day
          `
        : prisma.$queryRaw<
            { day: string; total: number; high: number | null }[]
          >`
            SELECT substr(timestamp::text, 1, 10) AS day, COUNT(*) AS total,
                   SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END) AS high
            FROM measurements
            GROUP BY substr(timestamp::text, 1, 10)
            ORDER BY day
          `,
    ]);
    const byId = new Map(sensors.map((sensor) => [sensor.id, sensor]));
    const summary = new Map<
      number,
      { Alto: number; Baixo: number; "Sem leitura": number }
    >();
    for (const group of groups) {
      const row = summary.get(group.sensorId) ?? {
        Alto: 0,
        Baixo: 0,
        "Sem leitura": 0,
      };
      if (group.value === 1) row.Alto = group._count._all;
      else if (group.value === 0) row.Baixo = group._count._all;
      else row["Sem leitura"] = group._count._all;
      summary.set(group.sensorId, row);
    }
    const bySensor = [...summary.entries()].map(([id, counts]) => ({
      name: byId.get(id)?.name || String(id),
      ...counts,
      total: counts.Alto + counts.Baixo + counts["Sem leitura"],
    }));
    const rows = bySensor
      .filter((row) => row.total > 0)
      .sort(
        (left, right) =>
          right.total - left.total || left.name.localeCompare(right.name),
      );
    return {
      bySensor: rows.slice((page - 1) * limit, page * limit),
      byDay: daysRows.map((row) => ({
        day: row.day,
        total: Number(row.total),
        high: Number(row.high ?? 0),
      })),
      page,
      limit,
      totalSensors: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / limit)),
    };
  }
}
