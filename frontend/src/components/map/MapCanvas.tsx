import { useCallback, useEffect, useRef } from "react";
import maplibregl, { type LngLatLike, type MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { formatDistance, formatDuration, formatScore } from "../../lib/format";
import { buildRouteFeatures, computeBounds, fitBoundsOptions, type GeoPoint, type MapRouteInput } from "../../lib/map";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const WORLD_CENTER: [number, number] = [0, 25];
const WORLD_ZOOM = 2;
const MIN_ZOOM = 2;
const SELECTED_NONE = -1;

export interface MapCanvasProps {
  routes: MapRouteInput[];
  selectedRouteId: number | null;
  onSelectRoute: (routeIndex: number) => void;
  originPoint?: GeoPoint;
  destinationPoint?: GeoPoint;
  isCompact?: boolean;
}

interface PaintState {
  routes: MapRouteInput[];
  selectedRouteId: number | null;
  originPoint?: GeoPoint;
  destinationPoint?: GeoPoint;
}

export default function MapCanvas({
  routes,
  selectedRouteId,
  onSelectRoute,
  originPoint,
  destinationPoint,
  isCompact = false,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const paintedRef = useRef(false);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onSelectRouteRef = useRef(onSelectRoute);
  const paintStateRef = useRef<PaintState>({ routes, selectedRouteId, originPoint, destinationPoint });

  useEffect(() => {
    onSelectRouteRef.current = onSelectRoute;
  }, [onSelectRoute]);

  useEffect(() => {
    paintStateRef.current = { routes, selectedRouteId, originPoint, destinationPoint };
  }, [routes, selectedRouteId, originPoint, destinationPoint]);

  const paint = useCallback((map: maplibregl.Map) => {
    const state = paintStateRef.current;
    const source = map.getSource("routes") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    source.setData(buildRouteFeatures(state.routes));

    const selected = state.selectedRouteId ?? SELECTED_NONE;
    map.setFilter("route-selected", ["==", "$id", selected]);

    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];
    const points: Array<[string, GeoPoint]> = [];
    if (state.originPoint) points.push(["A", state.originPoint]);
    if (state.destinationPoint) points.push(["B", state.destinationPoint]);
    for (const [label, point] of points) {
      const element = document.createElement("div");
      element.className =
        "pointer-events-none flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-sand-900 text-xs font-bold text-white shadow-card";
      element.setAttribute("aria-hidden", "true");
      element.textContent = label;
      const marker = new maplibregl.Marker({ element })
        .setLngLat([point.longitude, point.latitude])
        .addTo(map);
      markersRef.current.push(marker);
    }

    const coords: GeoPoint[] = [];
    for (const route of state.routes) {
      for (const [lng, lat] of route.geometry.coordinates) {
        coords.push({ latitude: lat, longitude: lng });
      }
    }
    if (coords.length === 0) return;
    const bounds = computeBounds(coords);
    if (!bounds) return;
    const extent = new maplibregl.LngLatBounds([bounds.west, bounds.south], [bounds.east, bounds.north]);
    map.fitBounds(extent, fitBoundsOptions({ isCompact }));
  }, [isCompact]);

  const showRoutePopup = useCallback((map: maplibregl.Map, routeIndex: number, lngLat: LngLatLike) => {
    const route = paintStateRef.current.routes[routeIndex];
    if (!route) return;
    const popup = new maplibregl.Popup({ offset: 12 })
      .setLngLat(lngLat)
      .setHTML(routePopupHtml(route))
      .addTo(map);
    popupRef.current?.remove();
    popupRef.current = popup;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      style: STYLE_URL,
      center: WORLD_CENTER,
      zoom: WORLD_ZOOM,
      minZoom: MIN_ZOOM,
    });
    mapRef.current = map;

    map.once("load", () => {
      map.addSource("routes", { type: "geojson", data: buildRouteFeatures([]) });
      map.addLayer({
        id: "route-lines",
        type: "line",
        source: "routes",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 4,
          "line-opacity": 0.9,
        },
      });
      map.addLayer({
        id: "route-selected",
        type: "line",
        source: "routes",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 8,
          "line-opacity": 1,
        },
        filter: ["==", "$id", SELECTED_NONE],
      });
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      paintedRef.current = true;
      paint(map);
    });

    map.on("click", "route-lines", (event: MapLayerMouseEvent) => {
      const routeIndex = event.features?.[0]?.properties?.routeIndex as number | undefined;
      if (typeof routeIndex !== "number") return;
      onSelectRouteRef.current(routeIndex);
      showRoutePopup(map, routeIndex, event.lngLat);
    });

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      paintedRef.current = false;
    };
  }, [paint, showRoutePopup]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !paintedRef.current) return;
    paint(map);
  }, [paint, routes, selectedRouteId, originPoint, destinationPoint]);

  return <div ref={containerRef} data-testid="map-canvas" className="absolute inset-0" />;
}

function routePopupHtml(route: MapRouteInput): string {
  const parts: string[] = [];
  if (route.originLabel || route.destinationLabel) {
    parts.push(`<strong>${escapeHtml(route.originLabel)} → ${escapeHtml(route.destinationLabel)}</strong>`);
  }
  parts.push(`Distancia: ${formatDistance(route.distanceKm)}`);
  parts.push(`Duración: ${formatDuration(route.durationMinutes)}`);
  parts.push(`Índice: ${formatScore(route.score)}`);
  return `<div class="flex flex-col gap-0.5 text-sm">${parts.join("<br/>")}</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}