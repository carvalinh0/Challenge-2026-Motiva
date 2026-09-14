import type { Sensor } from "../entities/Sensor";

export interface CreateSensorData {
  /** NODE_ID na mesh — ver Sensor.id. */
  id: number;
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  type?: Sensor["type"];
  proxyId?: number | null;
}

/** Só os campos presentes são alterados — `undefined` significa "não mexer". */
export interface UpdateSensorData {
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  type?: Sensor["type"];
  proxyId?: number | null;
}

export interface SensorRepository {
  findById(id: number): Promise<Sensor | null>;
  findAll(): Promise<Sensor[]>;
  findPage(input: SensorPageQuery): Promise<{ items: Sensor[]; total: number }>;
  findByProxyId(proxyId: number): Promise<Sensor[]>;
  create(data: CreateSensorData): Promise<Sensor>;
  update(id: number, data: UpdateSensorData): Promise<Sensor | null>;
  delete(id: number): Promise<boolean>;
  touchLastSeen(id: number): Promise<void>;
  defer(id: number): Promise<Sensor | null>;
}

export interface SensorPageQuery {
  skip: number;
  take: number;
  type?: Sensor["type"];
  name?: string;
  activeSince?: Date;
  inactiveBefore?: Date;
  createdFrom?: Date;
  createdTo?: Date;
}
