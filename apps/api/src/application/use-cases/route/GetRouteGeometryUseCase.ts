import type { RouteMatrixProvider } from "../../../domain/repositories/RouteMatrixProvider";
import type {
  RouteGeometryDTO,
  RouteGeometryOutputDTO,
} from "../../dtos/route.dto";

export class GetRouteGeometryUseCase {
  constructor(private readonly routing: RouteMatrixProvider) {}

  async execute({ points }: RouteGeometryDTO): Promise<RouteGeometryOutputDTO> {
    return { points: await this.routing.geometry(points) };
  }
}
