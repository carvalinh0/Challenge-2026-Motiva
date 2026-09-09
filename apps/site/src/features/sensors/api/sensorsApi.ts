import { request, toQuery } from "@/lib/httpClient";
import { DEFAULT_HISTORY_SIZE } from "@/config/constants";
import type {
  CalibrationResult,
  HealthcheckResult,
  MeasurementValue,
  ProxyDetail,
  SensorDetail,
  SensorFilters,
  SensorInput,
  SensorSummary,
} from "@/types/sensor";

const id = (value: number) => String(value);

/** Rotas de sensores, proxies e medições. */
export const sensorsApi = {
  list: (filters: SensorFilters = {}) =>
    request<SensorSummary[]>(
      `/api/sensors${toQuery({
        proxy: filters.proxy,
        active: filters.active,
        lost: filters.lost,
        closeTo: filters.closeTo,
        radius: filters.radius,
      })}`,
    ),

  get: (sensorId: number, measurements = DEFAULT_HISTORY_SIZE) =>
    request<SensorDetail>(`/api/sensors/${id(sensorId)}${toQuery({ measurements })}`),

  create: (sensorId: number, data: SensorInput) =>
    request<null>(`/api/sensors/${id(sensorId)}`, { method: "POST", body: data }),

  update: (sensorId: number, data: SensorInput) =>
    request<SensorSummary>(`/api/sensors/${id(sensorId)}`, {
      method: "PATCH",
      body: data,
    }),

  remove: (sensorId: number) =>
    request<null>(`/api/sensors/${id(sensorId)}`, { method: "DELETE" }),

  reset: (sensorId: number) =>
    request<null>(`/api/sensors/${id(sensorId)}/reset`, { method: "POST" }),

  // --- Medições (push direto, sem passar pela mesh) ---
  addMeasurement: (sensorId: number, value: MeasurementValue) =>
    request<null>(`/api/sensors/${id(sensorId)}/measurement`, {
      method: "POST",
      body: { value },
    }),

  addMeasurementsBulk: (items: { id: string; value: MeasurementValue }[]) =>
    request<{ failed: string[] }>("/api/sensors/measurements", {
      method: "POST",
      body: { data: items },
    }),

  // --- Proxy ---
  createProxy: (proxyId: number, data: SensorInput) =>
    request<null>(`/api/proxy/${id(proxyId)}`, { method: "POST", body: data }),

  getProxy: (proxyId: number) => request<ProxyDetail>(`/api/proxy/${id(proxyId)}`),

  removeProxy: (proxyId: number) =>
    request<null>(`/api/proxy/${id(proxyId)}`, { method: "DELETE" }),

  resetProxy: (proxyId: number) =>
    request<null>(`/api/proxy/${id(proxyId)}/reset`, { method: "POST" }),

  // --- Mesh: acionam o hardware de verdade e podem demorar ---
  /** Medição real via mesh (~90s no pior caso). */
  measureNow: (sensorId: number) =>
    request<number>(`/api/sensors/${id(sensorId)}/measurement`),

  healthcheck: (sensorId: number) =>
    request<HealthcheckResult>(`/api/sensors/${id(sensorId)}/healthcheck`),

  /** Calibração remota (~240s: varre o range inteiro nas duas direções). */
  calibrate: (sensorId: number) =>
    request<CalibrationResult>(`/api/sensors/${id(sensorId)}/calibrate`, {
      method: "POST",
    }),
};
