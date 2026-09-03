import { useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { DivIcon, LatLngExpression, LatLngTuple } from "leaflet";
import { FitBounds, pinIcon } from "@/lib/leafletMap";
import { formatTimestamp } from "@/utils/format";
import {
  NIVEL,
  NIVEL_BADGE_CLASS,
  NIVEL_MARKER_HEX,
  getNivel,
  nivelFromValue,
} from "@/utils/sensorStatus";
import { getMowingEstimate } from "@/utils/mowingEstimate";
import type { SensorSummary } from "@/types/sensor";

const PROXY_MARKER_HEX = "#5e22f3";

function buildIcon(sensor: SensorSummary): DivIcon {
  return pinIcon(
    sensor.type === "proxy"
      ? PROXY_MARKER_HEX
      : NIVEL_MARKER_HEX[getNivel(sensor) ?? nivelFromValue(null)],
  );
}

/**
 * Conteúdo do balão que abre ao clicar num marcador: a última leitura daquele
 * nó, com a mesma tradução de valor usada na tabela e nos gráficos.
 */
function SensorPopup({ sensor }: { sensor: SensorSummary }) {
  const isProxy = sensor.type === "proxy";
  const nivel = getNivel(sensor) ?? nivelFromValue(sensor.lastMeasurement?.value);
  const estimate = getMowingEstimate(sensor);

  return (
    <div className="min-w-52 text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between gap-3">
        <strong className="text-sm">{sensor.id}</strong>
        <span className="text-xs text-gray-500 dark:text-gray-300">
          {isProxy ? "Proxy" : `Nó ${sensor.node_id ?? "—"}`}
        </span>
      </div>

      <dl className="mt-2 space-y-1 text-xs">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-gray-500 dark:text-gray-300">Última leitura</dt>
          <dd>
            {isProxy ? (
              <span className="text-gray-500 dark:text-gray-300">não mede grama</span>
            ) : (
              <span
                className={`rounded px-1.5 py-0.5 font-medium ${NIVEL_BADGE_CLASS[nivel]}`}
              >
                {nivel}
              </span>
            )}
          </dd>
        </div>

        {!isProxy && nivel !== NIVEL.SEM_DADOS && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-500 dark:text-gray-300">Medida em</dt>
            <dd>{formatTimestamp(sensor.lastMeasurement?.timestamp)}</dd>
          </div>
        )}

        {estimate && estimate.estimatedHeight !== null && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-500 dark:text-gray-300">Altura estimada</dt>
            <dd>{estimate.estimatedHeight.toFixed(1)} cm</dd>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <dt className="text-gray-500 dark:text-gray-300">Visto por último</dt>
          <dd className={sensor.active ? undefined : "text-amber-600 dark:text-amber-400"}>
            {formatTimestamp(sensor.last_seen)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function SensorMap({ sensors }: { sensors: SensorSummary[] }) {
  // latitude/longitude são opcionais na API. Sem filtrar, um nó sem coordenada
  // vira [null, null] e o Leaflet quebra ao projetar — derrubando o mapa
  // inteiro, não só aquele marcador.
  const located = useMemo(
    () =>
      sensors.filter(
        (s): s is SensorSummary & { latitude: number; longitude: number } =>
          typeof s.latitude === "number" && typeof s.longitude === "number",
      ),
    [sensors],
  );

  const points = useMemo<LatLngTuple[]>(
    () => located.map((s) => [s.latitude, s.longitude]),
    [located],
  );

  if (points.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-300">
        Nenhum sensor com localização cadastrada
      </p>
    );
  }

  const center: LatLngExpression = points[0] as LatLngTuple;

  return (
    <MapContainer center={center} zoom={13} className="h-96 rounded-lg">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />
      {located.map((sensor) => (
        <Marker
          key={sensor.id}
          position={[sensor.latitude, sensor.longitude]}
          icon={buildIcon(sensor)}
        >
          <Popup minWidth={220}>
            <SensorPopup sensor={sensor} />
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
