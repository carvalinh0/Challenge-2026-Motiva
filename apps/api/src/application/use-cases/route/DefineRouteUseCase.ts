import { prisma } from "../../../infrastructure/database/prisma";
import type { DefineRouteDTO, DefinedRouteDTO } from "../../dtos/route.dto";
import { UnprocessableError } from "../../errors/ApplicationError";

export class DefineRouteUseCase {
  async execute(
    { sensorIds, base }: DefineRouteDTO,
    username: string,
  ): Promise<DefinedRouteDTO> {
    const route = await prisma.$transaction(async (tx) => {
      const available = await tx.sensor.count({
        where: { id: { in: sensorIds }, routeId: null },
      });
      if (available !== sensorIds.length)
        throw new UnprocessableError(
          "Um ou mais sensores já estão reservados por outra equipe.",
        );
      const created = await tx.route.create({
        data: {
          createdBy: username,
          baseLatitude: base.latitude,
          baseLongitude: base.longitude,
        },
      });
      await tx.sensor.updateMany({
        where: { id: { in: sensorIds }, routeId: null },
        data: { routeId: created.id },
      });
      return created;
    });
    return {
      id: route.id,
      status: "defined",
      sensorIds,
      createdBy: route.createdBy,
      createdAt: route.createdAt.getTime(),
      completedAt: null,
      base: { latitude: base.latitude, longitude: base.longitude },
    };
  }
}
