// Um nó físico da mesh. O proxy também é um Sensor (mede e reporta como
// qualquer outro) — o que muda é `type`, que lhe dá o papel extra de ponte
// entre o broker MQTT e o rádio LoRa.
export type SensorType = "sensor" | "proxy";

export interface Sensor {
    id: string;
    name: string | null;
    latitude: number | null;
    longitude: number | null;
    type: SensorType;
    /** NODE_ID na mesh LoRa. Sem ele o nó não pode ser acionado nem correlacionado. */
    nodeId: number | null;
    proxyId: string | null;
    lastSeen: Date | null;
}

/** NODE_ID reservado ao proxy na mesh (MESH_PROXY_NODE_ID no firmware). */
export const PROXY_NODE_ID = 0;

export function isProxy(sensor: Sensor): boolean {
    return sensor.type === "proxy";
}

/**
 * Um nó só conta como "ativo" se deu notícia dentro da janela. A janela é uma
 * folga em cima do ciclo de deep sleep do firmware, não um conceito rígido —
 * por isso entra como parâmetro em vez de constante fixa aqui.
 */
export function isActive(sensor: Sensor, activeWindowMs: number, now = Date.now()): boolean {
    if (!sensor.lastSeen) return false;
    return now - sensor.lastSeen.getTime() <= activeWindowMs;
}

export function canReceiveMeshCommand(sensor: Sensor): boolean {
    return sensor.nodeId !== null;
}

const EARTH_RADIUS_KM = 6371;

export function distanceKmBetween(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
): number {
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Só dá pra medir distância de quem tem coordenada cadastrada. */
export function isWithinRadius(
    sensor: Sensor,
    lat: number,
    lon: number,
    radiusKm: number,
): boolean {
    if (sensor.latitude === null || sensor.longitude === null) return false;
    return distanceKmBetween(lat, lon, sensor.latitude, sensor.longitude) <= radiusKm;
}
