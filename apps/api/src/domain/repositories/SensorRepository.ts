import type { Sensor } from "../entities/Sensor";

export interface CreateSensorData {
    id: string;
    name?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    type?: Sensor["type"];
    nodeId?: number | null;
    proxyId?: string | null;
}

/** Só os campos presentes são alterados — `undefined` significa "não mexer". */
export interface UpdateSensorData {
    name?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    type?: Sensor["type"];
    nodeId?: number | null;
    proxyId?: string | null;
}

export interface SensorRepository {
    findById(id: string): Promise<Sensor | null>;
    findByNodeId(nodeId: number): Promise<Sensor | null>;
    findAll(): Promise<Sensor[]>;
    findByProxyId(proxyId: string): Promise<Sensor[]>;
    /** Só os que têm nodeId — os únicos acionáveis via mesh. */
    findAllWithNodeId(): Promise<Sensor[]>;
    create(data: CreateSensorData): Promise<Sensor>;
    update(id: string, data: UpdateSensorData): Promise<Sensor | null>;
    delete(id: string): Promise<boolean>;
    touchLastSeen(id: string): Promise<void>;
}
