import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RouteCandidate } from "../types";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

function toColor(level: string): string {
  switch (level) {
    case "Low": return "#10b981";
    case "Moderate": return "#f59e0b";
    case "High": return "#f97316";
    default: return "#ef4444";
  }
}

export default function RouteMap({ routes }: { routes: RouteCandidate[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [1.8, 42.6],
      zoom: 5,
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || routes.length === 0) return;

    const paint = () => {
      const existingSource = map.getSource("routes");
      if (existingSource) {
        (existingSource as maplibregl.GeoJSONSource).setData(buildGeoJson(routes));
      } else {
        map.addSource("routes", { type: "geojson", data: buildGeoJson(routes) });
      }
      if (!map.getLayer("route-lines")) {
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
      }

      const coords = routes.flatMap((r) => r.polyline.map((p) => [p.longitude, p.latitude] as [number, number]));
      if (coords.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        for (const [lng, lat] of coords) bounds.extend([lng, lat]);
        map.fitBounds(bounds, { padding: 60 });
      }
    }

    if (map.isStyleLoaded()) paint();
    else map.once("load", paint);
  }, [routes]);

  return (
    <div ref={containerRef} className="h-[420px] w-full overflow-hidden rounded-xl border border-slate-200" />
  );
}

function buildGeoJson(routes: RouteCandidate[]) {
  return {
    type: "FeatureCollection",
    features: routes.map((r) => ({
      type: "Feature",
      properties: { color: toColor(r.riskLevel) },
      geometry: {
        type: "LineString",
        coordinates: r.polyline.map((p) => [p.longitude, p.latitude]),
      },
    })),
  };
}