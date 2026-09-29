import { describe, expect, it } from "vitest";
import type { RouteCandidate } from "../types";
import { findBestRouteIndex } from "./recommendation";

const baseRoute = (overrides: Partial<RouteCandidate> = {}): RouteCandidate => ({
  providerId: "provider",
  distanceKm: 74,
  durationMinutes: 168,
  riskLevel: "Moderate",
  riskScore: 60,
  factors: [],
  segments: [],
  polyline: [],
  ...overrides,
});

describe("findBestRouteIndex", () => {
  it("returns the first index when there are no routes", () => {
    expect(findBestRouteIndex([])).toBe(0);
  });

  it("picks the lower-risk route even when it is longer", () => {
    const routes = [
      baseRoute({ riskLevel: "Severe", distanceKm: 10, durationMinutes: 20 }),
      baseRoute({ riskLevel: "Moderate", distanceKm: 74, durationMinutes: 168 }),
    ];
    expect(findBestRouteIndex(routes)).toBe(1);
  });

  it("breaks severity ties by shortest distance", () => {
    const routes = [
      baseRoute({ riskLevel: "Low", distanceKm: 10, durationMinutes: 15, riskScore: 90 }),
      baseRoute({ riskLevel: "Low", distanceKm: 8, durationMinutes: 12, riskScore: 88 }),
    ];
    expect(findBestRouteIndex(routes)).toBe(1);
  });

  it("keeps the first route when severity and distance are identical", () => {
    const routes = [
      baseRoute({ riskLevel: "Low", distanceKm: 8, durationMinutes: 12, riskScore: 88 }),
      baseRoute({ riskLevel: "Low", distanceKm: 8, durationMinutes: 12, riskScore: 95 }),
    ];
    expect(findBestRouteIndex(routes)).toBe(0);
  });
});
