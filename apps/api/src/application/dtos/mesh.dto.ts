export interface HealthcheckResultDTO {
    id: string;
    alive: boolean;
}

export interface CalibrationResultDTO {
    id: string;
    ok: boolean;
}

export interface MeshNodeStatusDTO {
    id: string;
    node_id: number;
    alive: boolean;
}

export interface MeshNodeMeasurementDTO {
    id: string;
    node_id: number;
    /** null = o nó não respondeu dentro da janela do broadcast. */
    value: number | null;
}
