import { useCallback, useEffect, useRef } from "react";
import maplibregl, { type LngLatLike, type MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { formatDistance, formatDuration, formatScore } from "../../lib/format";
import { buildRouteFeatures, type GeoPoint, type MapRouteInput } from "../../lib/map";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const WORLD_CENTER: [number, number] = [0, 25];
const WORLD_ZOOM = 2;
const MIN_ZOOM = 2;
const HOVER_NONE = -1;
const DIMMED_OPACITY = 0.3;
const PROBE_LABEL = "•";

export type PickMode = "origin" | "destination" | "none";

export interface MapCanvasProps {
  routes: MapRouteInput[];
  selectedRouteId: number | null;
  onSelectRoute: (routeIndex: number) => void;
  originPoint?: GeoPoint;
  destinationPoint?: GeoPoint;
  isCompact?: boolean;
  hoveredRouteId?: number | null;
  onHoverRoute?: (routeIndex: number | null) => void;
  probePoint?: GeoPoint | null;
  pickMode?: PickMode;
  onPickPoint?: (point: GeoPoint) => void;
}

interface PaintState {
  routes: MapRouteInput[];
  selectedRouteId: number | null;
  originPoint?: GeoPoint;
  destinationPoint?: GeoPoint;
  hoveredRouteId: number | null;
  probePoint: GeoPoint | null;
  pickMode: PickMode;
}

export default function MapCanvas({
  routes,
  selectedRouteId,
  onSelectRoute,
  originPoint,
  destinationPoint,
  isCompact = false,
  hoveredRouteId = null,
  probePoint = null,
  pickMode = "none",
  onPickPoint,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const paintedRef = useRef(false);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onSelectRouteRef = useRef(onSelectRoute);
  const onPickPointRef = useRef(onPickPoint);
  const pickModeRef = useRef(pickMode);
  const paintStateRef = useRef<PaintState>({
    routes,
    selectedRouteId,
    originPoint,
    destinationPoint,
    hoveredRouteId,
    probePoint,
    pickMode,
  });
  const isCompactRef = useRef(isCompact);

  useEffect(() => {
    onSelectRouteRef.current = onSelectRoute;
  }, [onSelectRoute]);

  useEffect(() => {
    onPickPointRef.current = onPickPoint;
  }, [onPickPoint]);

  useEffect(() => {
    pickModeRef.current = pickMode;
  }, [pickMode]);

  useEffect(() => {
    isCompactRef.current = isCompact;
  }, [isCompact]);

  useEffect(() => {
    paintStateRef.current = {
      routes,
      selectedRouteId,
      originPoint,
      destinationPoint,
      hoveredRouteId,
      probePoint,
      pickMode,
    };
  }, [routes, selectedRouteId, originPoint, destinationPoint, hoveredRouteId, probePoint, pickMode]);

  const paint = useCallback((map: maplibregl.Map) => {
    const state = paintStateRef.current;
    const source = map.getSource("routes") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    source.setData(buildRouteFeatures(state.routes));
    map.setFilter("route-casing", ["==", ["get", "selected"], true]);
    map.setFilter("route-hover", ["==", "$id", state.hoveredRouteId ?? HOVER_NONE]);

    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];
    const points: Array<[string, GeoPoint]> = [];
    if (state.originPoint) points.push(["A", state.originPoint]);
    if (state.destinationPoint) points.push(["B", state.destinationPoint]);
    if (state.probePoint) points.push([PROBE_LABEL, state.probePoint]);
    for (const [label, point] of points) {
      const isProbe = label === PROBE_LABEL;
      const element = document.createElement("div");
      element.className = [
        "pointer-events-none flex h-6 w-6 items-center justify-center rounded-full border-2 border-white",
        isProbe ? "bg-sun-500 text-sand-900" : "bg-sand-900 text-white",
        "text-xs font-bold shadow-card",
      ].join(" ");
      element.setAttribute("aria-hidden", "true");
      element.textContent = label;
      const marker = new maplibregl.Marker({ element })
        .setLngLat([point.longitude, point.latitude])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, []);

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
        id: "route-casing",
        type: "line",
        source: "routes",
        filter: ["==", ["get", "selected"], true],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.95 },
      });
      map.addLayer({
        id: "route-hover",
        type: "line",
        source: "routes",
        filter: ["==", "$id", HOVER_NONE],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.7 },
      });
      map.addLayer({
        id: "route-lines",
        type: "line",
        source: "routes",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 5,
          "line-opacity": ["case", ["get", "selected"], 1, DIMMED_OPACITY],
        },
      });
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
      paintedRef.current = true;
      paint(map);
    });

    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      const hits = map.queryRenderedFeatures(event.point, { layers: ["route-lines"] });
      if (hits.length > 0) return;

      if (pickModeRef.current === "none") return;
      const pick = onPickPointRef.current;
      if (!pick) return;
      pick({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
    };

    map.on("click", handleMapClick);

    map.on("mousemove", "route-lines", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "route-lines", () => {
      map.getCanvas().style.cursor = pickModeRef.current === "none" ? "" : "crosshair";
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
      map.off("click", handleMapClick);
      map.remove();
      mapRef.current = null;
      paintedRef.current = false;
    };
  }, [paint, showRoutePopup]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = pickMode === "none" ? "" : "crosshair";
  }, [pickMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !paintedRef.current) return;
    paint(map);
  }, [paint, routes, selectedRouteId, originPoint, destinationPoint, isCompact, hoveredRouteId, probePoint]);

  return <div ref={containerRef} data-testid="map-canvas" className="absolute inset-0" />;
}

function routePopupHtml(route: MapRouteInput): string {
  const parts: string[] = [];
  const origin = escapeHtml(route.originLabel.trim());
  const destination = escapeHtml(route.destinationLabel.trim());
  const header = [origin, destination].filter(Boolean).join(" → ");
  if (header) parts.push(`<strong>${header}</strong>`);
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