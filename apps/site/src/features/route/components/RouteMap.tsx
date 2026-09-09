import { useMemo } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLngExpression, LatLngTuple } from "leaflet";
import { ClickToPick, FitBounds, numberedIcon, pinIcon } from "@/lib/leafletMap";
import type { GeoPoint } from "@/types/sensor";

const BASE_HEX = "#111827";
const STOP_HEX = "#6126F1";
const LEFT_OUT_HEX = "#9ca3af";

export interface MapPoint {
  id: number;
  point: GeoPoint;
}

interface RouteMapProps {
  base: GeoPoint | null;
  /** Paradas na ordem em que serão visitadas. */
  stops: MapPoint[];
  /** Candidatos que ficaram fora do roteiro do dia. */
  leftOut: MapPoint[];
  onPickBase: (latitude: number, longitude: number) => void;
}

function tuple(point: GeoPoint): LatLngTuple {
  return [point.latitude, point.longitude];
}

export function RouteMap({ base, stops, leftOut, onPickBase }: RouteMapProps) {
  const bounds = useMemo<LatLngTuple[]>(
    () =>
      [...(base ? [base] : []), ...stops.map((s) => s.point), ...leftOut.map((s) => s.point)].map(
        tuple,
      ),
    [base, stops, leftOut],
  );

  // A rota fecha na base: sai dela e volta para ela. Sem o retorno, o desenho
  // sugeriria que o dia acaba na última parada.
  const line = useMemo<LatLngTuple[]>(
    () =>
      base && stops.length > 0
        ? [tuple(base), ...stops.map((s) => tuple(s.point)), tuple(base)]
        : [],
    [base, stops],
  );

  const center: LatLngExpression = bounds[0] ?? [-15.78, -47.93];

  return (
    <MapContainer center={center} zoom={12} className="h-[28rem] rounded-lg">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={bounds} />
      <ClickToPick onPick={onPickBase} />

      {line.length > 0 && <Polyline positions={line} color={STOP_HEX} weight={4} opacity={0.7} />}

      {base && (
        <Marker position={tuple(base)} icon={pinIcon(BASE_HEX)}>
          <Popup>Base da equipe</Popup>
        </Marker>
      )}

      {leftOut.map((item) => (
        <Marker key={item.id} position={tuple(item.point)} icon={pinIcon(LEFT_OUT_HEX)}>
          <Popup>{item.id} — fora do roteiro de hoje</Popup>
        </Marker>
      ))}

      {stops.map((stop, index) => (
        <Marker
          key={stop.id}
          position={tuple(stop.point)}
          icon={numberedIcon(STOP_HEX, index + 1)}
        >
          <Popup>
            {index + 1}ª parada — {stop.id}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
