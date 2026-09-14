import { useEffect, useMemo, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";

// Peças compartilhadas entre o mapa de sensores e o do roteiro. Os ícones são
// HTML puro porque o Leaflet vive fora da árvore do React — não há build do
// Tailwind processando classes aqui, então as cores vêm em hex.

/**
 * Reenquadra sempre que o conjunto de pontos muda. Sem isso o mapa fica preso
 * no primeiro nó e os demais somem fora da viewport.
 */
export function FitBounds({
  points,
  once = false,
}: {
  points: LatLngTuple[];
  once?: boolean;
}) {
  const map = useMap();
  const hasFitted = useRef(false);
  const pointsKey = points
    .map(([latitude, longitude]) => `${latitude},${longitude}`)
    .join("|");
  const bounds = useMemo(
    () => (points.length > 0 ? L.latLngBounds(points) : null),
    [pointsKey],
  );

  useEffect(() => {
    if (!bounds) return;
    if (once && hasFitted.current) return;
    if (bounds.getSouthWest().equals(bounds.getNorthEast())) {
      map.setView(bounds.getCenter(), 15);
      hasFitted.current = true;
      return;
    }
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    hasFitted.current = true;
  }, [bounds, map, once]);

  return null;
}

/** Chama `onPick` com a coordenada de cada clique no mapa. */
export function ClickToPick({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (event) => onPick(event.latlng.lat, event.latlng.lng),
  });
  return null;
}

/** Ícone "map-pin" do lucide, escrito à mão como string. */
export function pinIcon(color: string): L.DivIcon {
  return new L.DivIcon({
    html:
      `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" ` +
      `fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" ` +
      `stroke-linejoin="round" aria-hidden="true">` +
      `<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>` +
      `<circle cx="12" cy="10" r="3"/></svg>`,
    className: "bg-transparent border-0",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

/** Disco numerado, usado para mostrar a ordem das paradas do roteiro. */
export function numberedIcon(color: string, position: number): L.DivIcon {
  return new L.DivIcon({
    html:
      `<div style="background:${color};color:#fff;width:26px;height:26px;border-radius:50%;` +
      `display:flex;align-items:center;justify-content:center;` +
      `font:700 13px/1 system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.4)">${position}</div>`,
    className: "bg-transparent border-0",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}
