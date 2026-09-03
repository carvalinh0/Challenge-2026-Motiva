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

const id = (value: string) => encodeURIComponent(value);

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

  get: (sensorId: string, measurements = DEFAULT_HISTORY_SIZE) =>
    request<SensorDetail>(`/api/sensors/${id(sensorId)}${toQuery({ measurements })}`),

  create: (sensorId: string, data: SensorInput) =>
    request<null>(`/api/sensors/${id(sensorId)}`, { method: "POST", body: data }),

  update: (sensorId: string, data: SensorInput) =>
    request<SensorSummary>(`/api/sensors/${id(sensorId)}`, {
      method: "PATCH",
      body: data,
    }),

  remove: (sensorId: string) =>
    request<null>(`/api/sensors/${id(sensorId)}`, { method: "DELETE" }),

  reset: (sensorId: string) =>
    request<null>(`/api/sensors/${id(sensorId)}/reset`, { method: "POST" }),

  // --- Medições (push direto, sem passar pela mesh) ---
  addMeasurement: (sensorId: string, value: MeasurementValue) =>
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
  createProxy: (proxyId: string, data: SensorInput) =>
    request<null>(`/api/proxy/${id(proxyId)}`, { method: "POST", body: data }),

  getProxy: (proxyId: string) => request<ProxyDetail>(`/api/proxy/${id(proxyId)}`),

  removeProxy: (proxyId: string) =>
    request<null>(`/api/proxy/${id(proxyId)}`, { method: "DELETE" }),

  resetProxy: (proxyId: string) =>
    request<null>(`/api/proxy/${id(proxyId)}/reset`, { method: "POST" }),

  // --- Mesh: acionam o hardware de verdade e podem demorar ---
  /** Medição real via mesh (~90s no pior caso). */
  measureNow: (sensorId: string) =>
    request<number>(`/api/sensors/${id(sensorId)}/measurement`),

  healthcheck: (sensorId: string) =>
    request<HealthcheckResult>(`/api/sensors/${id(sensorId)}/healthcheck`),

  /** Calibração remota (~240s: varre o range inteiro nas duas direções). */
  calibrate: (sensorId: string) =>
    request<CalibrationResult>(`/api/sensors/${id(sensorId)}/calibrate`, {
      method: "POST",
    }),
};
