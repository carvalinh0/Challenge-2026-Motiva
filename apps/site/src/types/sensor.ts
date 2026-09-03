// Modelo de domínio compartilhado entre as features (dashboard, sensores e
// gráficos falam todos sobre estas mesmas entidades).
// Espelha `apps/api/src/application/dtos/sensor.dto.ts`.

export type SensorType = "sensor" | "proxy";

/**
 * Valor de uma medição, exatamente como sai do firmware
 * (`apps/sensor/command_dispatcher.h`). A API não reinterpreta esses códigos,
 * e o site também não: quem exibe é que decide como traduzir.
 */
export const MEASUREMENT_VALUE = {
  BELOW_LIMIT: 0,
  ABOVE_LIMIT: 1,
  UNRELIABLE: 2,
} as const;

export type MeasurementValue =
  (typeof MEASUREMENT_VALUE)[keyof typeof MEASUREMENT_VALUE];

export interface Measurement {
  /** Epoch em ms. */
  timestamp: number;
  value: MeasurementValue;
}

/** Item da listagem `GET /api/sensors`. */
export interface SensorSummary {
  id: string;
  latitude: number | null;
  longitude: number | null;
  type: SensorType;
  node_id: number | null;
  /** Epoch ms da última vez que o nó deu notícia; null se nunca reportou. */
  last_seen: number | null;
  /** `last_seen` dentro da janela de atividade (SENSOR_ACTIVE_WINDOW_MS na API). */
  active: boolean;
  lastMeasurement: Measurement | null;
  /**
   * Dias seguidos reportando acima do limite. É a prioridade de roçada, e a
   * API é quem calcula (só ela tem o histórico de todos os nós de uma vez).
   */
  consecutiveHighDays: number;
}

/** Resposta de `GET /api/sensors/:id`, com histórico. */
export interface SensorDetail {
  id: string;
  latitude: number | null;
  longitude: number | null;
  type: SensorType;
  node_id: number | null;
  lastMeasurements: Measurement[];
}

export interface ProxyDetail extends SensorDetail {
  sensors: SensorSummary[];
}

/** Campos aceitos na criação/atualização. Ausente = não mexer. */
export interface SensorInput {
  name?: string;
  latitude?: number;
  longitude?: number;
  type?: SensorType;
  proxy_id?: string;
  node_id?: number;
}

// --- Mesh ---

export type MeshAction = "CALIBRATE" | "MEASURE" | "HEALTHCHECK";

/** Evento recebido ao vivo por SSE em `GET /api/events`. */
export interface MeshResult {
  sourceNode: number;
  action: MeshAction;
  result: number;
}

export interface HealthcheckResult {
  id: string;
  alive: boolean;
}

export interface CalibrationResult {
  id: string;
  ok: boolean;
}

export interface MeshNodeStatus {
  id: string;
  node_id: number;
  alive: boolean;
}

export interface MeshNodeMeasurement {
  id: string;
  node_id: number;
  /** null = o nó não respondeu dentro da janela do broadcast. */
  value: number | null;
}

/** Filtros de `GET /api/sensors`. */
export interface SensorFilters {
  proxy?: string;
  active?: boolean;
  lost?: boolean;
  /** "latitude,longitude" */
  closeTo?: string;
  /** km; só tem efeito junto com closeTo. */
  radius?: number;
}

// --- Roteiro de roçada ---

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Resposta de `POST /api/route/matrix`. */
export interface RouteMatrix {
  /** durations[i][j] em segundos, na mesma ordem dos pontos enviados. */
  durations: number[][];
  /** "haversine" = o OSRM não respondeu e os tempos são uma estimativa. */
  source: "osrm" | "haversine";
}
