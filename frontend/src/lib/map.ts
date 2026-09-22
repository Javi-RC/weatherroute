import { RISK_COLORS } from "../i18n/risk";
import type { RiskLevel } from "../types";

export type LngLat = [number, number];

export interface LineStringGeometry {
  type: "LineString";
  coordinates: LngLat[];
}

export interface MapRouteInput {
  riskLevel: RiskLevel;
  distanceKm: number;
  durationMinutes: number;
  score: number;
  originLabel: string;
  destinationLabel: string;
  geometry: LineStringGeometry;
}

export interface RouteFeatureProperties {
  riskLevel: RiskLevel;
  color: string;
  routeIndex: number;
  distanceKm: number;
  durationMinutes: number;
  score: number;
  originLabel: string;
  destinationLabel: string;
}

export interface RouteFeature {
  type: "Feature";
  id: number;
  properties: RouteFeatureProperties;
  geometry: LineStringGeometry;
}

export interface RouteFeatureCollection {
  type: "FeatureCollection";
  features: RouteFeature[];
}

export function buildRouteFeatures(routes: readonly MapRouteInput[]): RouteFeatureCollection {
  return {
    type: "FeatureCollection",
    features: routes.map((route, routeIndex) => ({
      type: "Feature",
      id: routeIndex,
      properties: {
        riskLevel: route.riskLevel,
        color: RISK_COLORS[route.riskLevel].base,
        routeIndex,
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
        score: route.score,
        originLabel: route.originLabel,
        destinationLabel: route.destinationLabel,
      },
      geometry: route.geometry,
    })),
  };
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Bounds {
  east: number;
  west: number;
  north: number;
  south: number;
}

export function computeBounds(points: readonly GeoPoint[]): Bounds | null {
  if (points.length === 0) return null;

  let west = points[0].longitude;
  let east = points[0].longitude;
  let south = points[0].latitude;
  let north = points[0].latitude;

  for (const point of points) {
    if (point.longitude < west) west = point.longitude;
    if (point.longitude > east) east = point.longitude;
    if (point.latitude < south) south = point.latitude;
    if (point.latitude > north) north = point.latitude;
  }

  return { east, west, north, south };
}

export interface MapView {
  isCompact: boolean;
}

export interface FitBoundsOptions {
  padding: { top: number; right: number; bottom: number; left: number };
  maxZoom?: number;
}

const DESKTOP_PADDING = 64;
const MOBILE_EDGE_PADDING = 24;
const MOBILE_TOP_PADDING = 64;
const MOBILE_BOTTOM_PADDING = 320;
const FIT_MAX_ZOOM = 14;

export function fitBoundsOptions(view: MapView): FitBoundsOptions {
  if (view.isCompact) {
    return {
      padding: {
        top: MOBILE_TOP_PADDING,
        right: MOBILE_EDGE_PADDING,
        bottom: MOBILE_BOTTOM_PADDING,
        left: MOBILE_EDGE_PADDING,
      },
      maxZoom: FIT_MAX_ZOOM,
    };
  }

  return {
    padding: {
      top: DESKTOP_PADDING,
      right: DESKTOP_PADDING,
      bottom: DESKTOP_PADDING,
      left: DESKTOP_PADDING,
    },
    maxZoom: FIT_MAX_ZOOM,
  };
}