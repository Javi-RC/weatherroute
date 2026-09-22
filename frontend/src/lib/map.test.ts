import { describe, expect, it } from "vitest";
import { RISK_COLORS } from "../i18n/risk";
import type { RiskLevel } from "../types";
import {
  buildRouteFeatures,
  computeBounds,
  fitBoundsOptions,
  type LineStringGeometry,
  type MapRouteInput,
} from "./map";

const RISK_LEVELS: RiskLevel[] = ["Low", "Moderate", "High", "Severe"];

function lineString(...coords: [number, number][]): LineStringGeometry {
  return { type: "LineString", coordinates: coords };
}

function route(overrides: Partial<MapRouteInput> = {}): MapRouteInput {
  return {
    riskLevel: "Low",
    distanceKm: 10,
    durationMinutes: 90,
    score: 80,
    originLabel: "Andorra la Vella",
    destinationLabel: "Encamp",
    geometry: lineString([1.5, 42.5], [1.6, 42.5]),
    ...overrides,
  };
}

describe("buildRouteFeatures", () => {
  it("returns an empty FeatureCollection for no routes", () => {
    expect(buildRouteFeatures([])).toEqual({ type: "FeatureCollection", features: [] });
  });

  it("maps each route to a Feature with the expected properties and id", () => {
    const features = buildRouteFeatures([
      route({ riskLevel: "Moderate", distanceKm: 12.3, durationMinutes: 75, score: 62 }),
      route({ riskLevel: "Severe", distanceKm: 8.1, durationMinutes: 60, score: 25 }),
    ]).features;

    expect(features).toHaveLength(2);
    expect(features[0]).toEqual({
      type: "Feature",
      id: 0,
      properties: {
        riskLevel: "Moderate",
        color: RISK_COLORS.Moderate.base,
        routeIndex: 0,
        distanceKm: 12.3,
        durationMinutes: 75,
        score: 62,
        originLabel: "Andorra la Vella",
        destinationLabel: "Encamp",
      },
      geometry: lineString([1.5, 42.5], [1.6, 42.5]),
    });
    expect(features[1].id).toBe(1);
    expect(features[1].properties.routeIndex).toBe(1);
  });

  it("carries the color from RISK_COLORS for every risk level", () => {
    const features = buildRouteFeatures(RISK_LEVELS.map((riskLevel) => route({ riskLevel }))).features;
    for (const [index, feature] of features.entries()) {
      expect(feature.properties.riskLevel).toBe(RISK_LEVELS[index]);
      expect(feature.properties.color).toBe(RISK_COLORS[RISK_LEVELS[index]].base);
    }
  });

  it("passes the geometry through unchanged", () => {
    const geometry = lineString([2, 42], [2.1, 42.1], [2.2, 42.2]);
    const [feature] = buildRouteFeatures([route({ geometry })]).features;
    expect(feature.geometry).toEqual(geometry);
  });
});

describe("computeBounds", () => {
  it("computes min/max latitude and longitude over multiple points", () => {
    const bounds = computeBounds([
      { latitude: 42.6, longitude: -1.5 },
      { latitude: 40.1, longitude: 1.8 },
      { latitude: 51.2, longitude: -3.7 },
    ]);
    expect(bounds).toEqual({ east: 1.8, west: -3.7, north: 51.2, south: 40.1 });
  });

  it("collapses a single point to a zero-extent bounds", () => {
    expect(computeBounds([{ latitude: 42.5, longitude: 1.6 }])).toEqual({
      east: 1.6,
      west: 1.6,
      north: 42.5,
      south: 42.5,
    });
  });

  it("returns null for an empty array", () => {
    expect(computeBounds([])).toBeNull();
  });
});

describe("fitBoundsOptions", () => {
  it("uses symmetric padding on desktop", () => {
    const options = fitBoundsOptions({ isCompact: false });
    expect(options.padding.top).toBe(options.padding.right);
    expect(options.padding.right).toBe(options.padding.bottom);
    expect(options.padding.bottom).toBe(options.padding.left);
    expect(options.padding.top).toBe(64);
  });

  it("adds extra bottom padding on compact layouts to clear sheets", () => {
    const compact = fitBoundsOptions({ isCompact: true });
    expect(compact.padding.bottom).toBeGreaterThan(compact.padding.top);
    expect(compact.padding.bottom).toBe(320);
    expect(compact.padding.top).toBe(64);
    expect(compact.padding.bottom).toBeGreaterThan(compact.padding.left);
  });

  it("caps the fit zoom on both layouts", () => {
    expect(fitBoundsOptions({ isCompact: false }).maxZoom).toBe(14);
    expect(fitBoundsOptions({ isCompact: true }).maxZoom).toBe(14);
  });
});