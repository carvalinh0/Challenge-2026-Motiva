import type {
    GeoPoint,
    RouteMatrix,
    RouteMatrixProvider,
} from "../../domain/repositories/RouteMatrixProvider";
import { distanceKmBetween } from "../../domain/entities/Sensor";
import { log } from "./logger";

// Serviço /table do OSRM: uma requisição devolve a matriz inteira de tempos.
// Pedir rota par a par seria O(n²) requisições para a mesma informação.
const OSRM_TABLE_URL = "https://router.project-osrm.org/table/v1/driving";

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Velocidade média usada só no fallback. Sensores ficam à beira de rodovia, e
 * o deslocamento entre eles é rodoviário — 60 km/h já desconta o trecho
 * urbano das pontas.
 */
const FALLBACK_SPEED_KMH = 60;

interface OsrmTableResponse {
    code: string;
    /** null aparece quando o OSRM não encontra caminho entre o par. */
    durations?: (number | null)[][];
    message?: string;
}

export class OsrmRouteMatrixProvider implements RouteMatrixProvider {
    async durations(points: GeoPoint[]): Promise<RouteMatrix> {
        try {
            const durations = await this.fetchFromOsrm(points);
            return { durations, source: "osrm" };
        } catch (error) {
            // Um roteirizador indisponível não pode impedir o planejamento do
            // dia. A estimativa geométrica é pior, mas a tela avisa qual das
            // duas produziu os números.
            log.warn(
                "route",
                `OSRM indisponivel, usando estimativa geometrica: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
            return { durations: haversineMatrix(points), source: "haversine" };
        }
    }

    private async fetchFromOsrm(points: GeoPoint[]): Promise<number[][]> {
        // O OSRM espera longitude,latitude — invertido em relação ao resto do
        // sistema, que fala latitude primeiro.
        const coordinates = points
            .map((point) => `${point.longitude},${point.latitude}`)
            .join(";");

        const response = await fetch(
            `${OSRM_TABLE_URL}/${coordinates}?annotations=duration`,
            { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
        );

        if (!response.ok) {
            throw new Error(`OSRM respondeu ${response.status}`);
        }

        const body = (await response.json()) as OsrmTableResponse;
        if (body.code !== "Ok" || !body.durations) {
            throw new Error(body.message ?? `OSRM devolveu code=${body.code}`);
        }

        // Pares sem caminho viário voltam null; a estimativa geométrica cobre
        // só essas células, em vez de descartar a matriz toda.
        const fallback = haversineMatrix(points);
        return body.durations.map((row, i) =>
            row.map((seconds, j) => seconds ?? fallback[i]![j]!),
        );
    }
}

function haversineMatrix(points: GeoPoint[]): number[][] {
    const secondsPerKm = 3600 / FALLBACK_SPEED_KMH;

    return points.map((from) =>
        points.map((to) => {
            const km = distanceKmBetween(
                from.latitude,
                from.longitude,
                to.latitude,
                to.longitude,
            );
            return km * secondsPerKm;
        }),
    );
}
