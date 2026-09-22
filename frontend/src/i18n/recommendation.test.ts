import { describe, expect, it } from "vitest";
import type { RouteCandidate } from "../types";
import { buildRecommendation } from "./recommendation";

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

describe("buildRecommendation", () => {
  it("returns null when there are no routes", () => {
    expect(buildRecommendation([])).toBeNull();
  });

  it("recommends a single route with rounded km/min and the conditions label", () => {
    const routes = [baseRoute({ distanceKm: 74.4, durationMinutes: 167.6, riskScore: 72 })];
    expect(buildRecommendation(routes)).toBe(
      "Ruta 1 recomendada: 74 km, 168 min, condiciones Buenas",
    );
  });

  it("picks the lower-risk route even when it is longer", () => {
    const routes = [
      baseRoute({ riskLevel: "Severe", distanceKm: 10, durationMinutes: 20 }),
      baseRoute({ riskLevel: "Moderate", distanceKm: 74, durationMinutes: 168 }),
    ];
    expect(buildRecommendation(routes)).toBe(
      "Ruta 2 recomendada: 74 km, 168 min, condiciones Buenas",
    );
  });

  it("breaks severity ties by shortest distance", () => {
    const routes = [
      baseRoute({ riskLevel: "Low", distanceKm: 10, durationMinutes: 15, riskScore: 90 }),
      baseRoute({ riskLevel: "Low", distanceKm: 8, durationMinutes: 12, riskScore: 88 }),
    ];
    expect(buildRecommendation(routes)).toBe(
      "Ruta 2 recomendada: 8 km, 12 min, condiciones Muy buenas",
    );
  });

  it("renders the worst band label for low condition scores", () => {
    const routes = [baseRoute({ riskScore: 24 })];
    expect(buildRecommendation(routes)).toBe(
      "Ruta 1 recomendada: 74 km, 168 min, condiciones Malas",
    );
  });
});