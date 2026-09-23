import type { RiskLevel, RouteCandidate } from "../types";
import { conditionsLabel } from "./risk";

const SEVERITY: Record<RiskLevel, number> = {
  Low: 0,
  Moderate: 1,
  High: 2,
  Severe: 3,
};

export function findBestRouteIndex(routes: RouteCandidate[]): number {
  let bestIndex = 0;
  for (let i = 1; i < routes.length; i++) {
    const current = routes[i];
    const best = routes[bestIndex];
    const better =
      SEVERITY[current.riskLevel] < SEVERITY[best.riskLevel] ||
      (SEVERITY[current.riskLevel] === SEVERITY[best.riskLevel] &&
        current.distanceKm < best.distanceKm);
    if (better) bestIndex = i;
  }
  return bestIndex;
}

export function buildRecommendation(routes: RouteCandidate[]): string | null {
  if (routes.length === 0) return null;

  const bestIndex = findBestRouteIndex(routes);
  const best = routes[bestIndex];
  const km = Math.round(best.distanceKm);
  const min = Math.round(best.durationMinutes);
  return `Ruta ${bestIndex + 1} recomendada: ${km} km, ${min} min, condiciones ${conditionsLabel(best.riskScore)}`;
}