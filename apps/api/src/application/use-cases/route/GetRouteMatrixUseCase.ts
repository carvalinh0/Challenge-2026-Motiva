import type { RouteMatrixProvider } from "../../../domain/repositories/RouteMatrixProvider";
import type { RouteMatrixDTO, RouteMatrixOutputDTO } from "../../dtos/route.dto";

/**
 * Tempos de deslocamento entre os pontos de um roteiro.
 *
 * A API só entrega a matriz; quem escolhe as paradas e a ordem é o site. A
 * divisão é proposital: a matriz depende de rede (OSRM) e muda pouco, enquanto
 * a otimização precisa rodar de novo a cada ajuste de jornada, número de
 * pontos ou tempo de roçada — e isso tem que ser instantâneo.
 */
export class GetRouteMatrixUseCase {
    constructor(private readonly routing: RouteMatrixProvider) {}

    async execute({ points }: RouteMatrixDTO): Promise<RouteMatrixOutputDTO> {
        const { durations, source } = await this.routing.durations(points);
        return { durations, source };
    }
}
