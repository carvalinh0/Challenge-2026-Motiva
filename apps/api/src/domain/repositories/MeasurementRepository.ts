import type { Measurement } from "../entities/Measurement";

export interface MeasurementRepository {
    create(sensorId: string, value: number): Promise<Measurement>;
    /** Mais recentes primeiro. */
    findLatestBySensor(sensorId: string, limit: number): Promise<Measurement[]>;
    /** Atalho do caso `limit = 1`, usado na listagem de sensores. */
    findLastBySensor(sensorId: string): Promise<Measurement | null>;
    /**
     * Medições de TODOS os sensores a partir de `since`. Uma consulta só, em
     * vez de uma por sensor: a listagem precisa do histórico recente de todo
     * mundo ao mesmo tempo para calcular a prioridade de roçada.
     */
    findAllSince(since: Date): Promise<Measurement[]>;
    deleteBySensor(sensorId: string): Promise<void>;
}
