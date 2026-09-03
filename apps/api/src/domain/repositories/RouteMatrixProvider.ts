export interface GeoPoint {
    latitude: number;
    longitude: number;
}

export type RouteMatrixSource = "osrm" | "haversine";

export interface RouteMatrix {
    /** durations[i][j] = segundos para ir do ponto i ao ponto j. */
    durations: number[][];
    /**
     * De onde vieram os números. O planejador mostra isso na tela: uma rota
     * calculada com a estimativa de fallback merece menos confiança do que
     * uma calculada sobre a malha viária real.
     */
    source: RouteMatrixSource;
}

/**
 * Tempo de deslocamento entre pontos. Existe como porta no domínio porque a
 * origem desses números é uma decisão de infraestrutura — hoje o OSRM, com
 * queda para uma estimativa geométrica quando ele não responde.
 */
export interface RouteMatrixProvider {
    durations(points: GeoPoint[]): Promise<RouteMatrix>;
}
