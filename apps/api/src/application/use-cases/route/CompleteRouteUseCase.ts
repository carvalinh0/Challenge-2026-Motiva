import { prisma } from "../../../infrastructure/database/prisma";
import { MEASUREMENT_VALUE } from "../../../domain/entities/Measurement";
import type { DefinedRouteDTO } from "../../dtos/route.dto";
import {
  NotFoundError,
  UnprocessableError,
} from "../../errors/ApplicationError";

export class CompleteRouteUseCase {
  async execute(id: number, _username: string): Promise<DefinedRouteDTO> {
    const route = await prisma.route.findUnique({
      where: { id },
      include: { sensors: true },
    });
    if (!route) throw new NotFoundError("Rota não encontrada");
    if (route.status !== "defined")
      throw new UnprocessableError("Essa rota já foi concluída.");
    const completedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.measurement.createMany({
        data: route.sensors.map((sensor) => ({
          sensorId: sensor.id,
          value: MEASUREMENT_VALUE.BELOW_LIMIT,
        })),
      });
      await tx.sensor.updateMany({
        where: { routeId: id },
        data: { routeId: null },
      });
      await tx.route.update({
        where: { id },
        data: { status: "completed", completedAt },
      });
    });
    return {
      id,
      status: "completed",
      sensorIds: route.sensors.map((sensor) => sensor.id),
      createdBy: route.createdBy,
      createdAt: route.createdAt.getTime(),
      completedAt: completedAt.getTime(),
      base: { latitude: route.baseLatitude, longitude: route.baseLongitude },
    };
  }
}
