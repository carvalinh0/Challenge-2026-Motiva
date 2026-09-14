import { useMemo } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLngExpression, LatLngTuple } from "leaflet";
import {
  ClickToPick,
  FitBounds,
  numberedIcon,
  pinIcon,
} from "@/lib/leafletMap";
import type { GeoPoint } from "@/types/sensor";

const BASE_HEX = "#111827";
const STOP_HEX = "#6126F1";
const LEFT_OUT_HEX = "#9ca3af";

export interface MapPoint {
  id: number;
  name?: string | null;
  point: GeoPoint;
  status?: string;
  reading?: string;
  daysDetecting?: number;
  estimatedHeight?: number | null;
}

interface RouteMapProps {
  base: GeoPoint | null;
  geometry?: GeoPoint[];
  /** Paradas na ordem em que serão visitadas. */
  stops: MapPoint[];
  /** Candidatos que ficaram fora do roteiro do dia. */
  leftOut: MapPoint[];
  onPickBase?: (latitude: number, longitude: number) => void;
}

function tuple(point: GeoPoint): LatLngTuple {
  return [point.latitude, point.longitude];
}

export function RouteMap({
  base,
  geometry = [],
  stops,
  leftOut,
  onPickBase,
}: RouteMapProps) {
  const bounds = useMemo<LatLngTuple[]>(
    () =>
      [
        ...(base ? [base] : []),
        ...stops.map((s) => s.point),
        ...leftOut.map((s) => s.point),
      ].map(tuple),
    [base, stops, leftOut],
  );

  const center: LatLngExpression = bounds[0] ?? [-15.78, -47.93];

  return (
    <MapContainer
      center={center}
      zoom={12}
      className="h-[calc(100vh-19rem)] min-h-[28rem] rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={bounds} once />
      {onPickBase && <ClickToPick onPick={onPickBase} />}

      {geometry.length > 0 && (
        <Polyline
          positions={geometry.map(tuple)}
          color={STOP_HEX}
          weight={4}
          opacity={0.75}
        />
      )}

      {base && (
        <Marker position={tuple(base)} icon={pinIcon(BASE_HEX)}>
          <Popup>Base da equipe</Popup>
        </Marker>
      )}

      {leftOut.map((item) => (
        <Marker
          key={item.id}
          position={tuple(item.point)}
          icon={pinIcon(LEFT_OUT_HEX)}
        >
          <Popup>
            <SensorPopup
              item={item}
              title={`${item.name || item.id}`}
              description="Fora do roteiro de hoje"
            />
          </Popup>
        </Marker>
      ))}

      {stops.map((stop, index) => (
        <Marker
          key={stop.id}
          position={tuple(stop.point)}
          icon={numberedIcon(STOP_HEX, index + 1)}
        >
          <Popup>
            <SensorPopup
              item={stop}
              title={`${index + 1}ª parada — ${stop.name || stop.id}`}
              description="Incluído no roteiro de hoje"
            />
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

function SensorPopup({
  item,
  title,
  description,
}: {
  item: MapPoint;
  title: string;
  description: string;
}) {
  return (
    <div className="min-w-48 space-y-1 text-sm">
      <strong className="block">{title}</strong>
      <span className="block text-gray-500">{description}</span>
      <span className="block">ID: {item.id}</span>
      {item.status && <span className="block">Status: {item.status}</span>}
      {item.reading && (
        <span className="block">Última leitura: {item.reading}</span>
      )}
      {item.daysDetecting !== undefined && (
        <span className="block">
          Vegetação alta há {item.daysDetecting} dia(s)
        </span>
      )}
      {item.estimatedHeight !== undefined && item.estimatedHeight !== null && (
        <span className="block">
          Altura estimada: ~{item.estimatedHeight.toFixed(0)} cm
        </span>
      )}
    </div>
  );
}
