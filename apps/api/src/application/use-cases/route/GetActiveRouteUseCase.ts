import { prisma } from "../../../infrastructure/database/prisma";
import type { DefinedRouteDTO } from "../../dtos/route.dto";

export class GetActiveRouteUseCase {
  async execute(username: string): Promise<DefinedRouteDTO | null> {
    const route = await prisma.route.findFirst({
      where: { createdBy: username, status: "defined" },
      include: { sensors: true },
      orderBy: { createdAt: "desc" },
    });
    if (!route) return null;
    return {
      id: route.id,
      status: "defined",
      sensorIds: route.sensors.map((sensor) => sensor.id),
      createdBy: route.createdBy,
      createdAt: route.createdAt.getTime(),
      completedAt: null,
      base: { latitude: route.baseLatitude, longitude: route.baseLongitude },
    };
  }
}
