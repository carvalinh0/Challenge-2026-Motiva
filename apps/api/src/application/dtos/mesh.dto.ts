export interface HealthcheckResultDTO {
    id: number;
    alive: boolean;
}

export interface CalibrationResultDTO {
    id: number;
    ok: boolean;
}

export interface MeshNodeStatusDTO {
    id: number;
    alive: boolean;
}

export interface MeshNodeMeasurementDTO {
    id: number;
    value: number | null;
    busy: boolean;
}
