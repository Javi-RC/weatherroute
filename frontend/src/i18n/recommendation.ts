import type { RiskLevel, RouteCandidate } from "../types";

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
