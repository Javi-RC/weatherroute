import type { RouteCandidate } from "../../types";
import { buildRecommendation, findBestRouteIndex } from "../../i18n/recommendation";
import { formatDistance, formatDuration } from "../../lib/format";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import ScoreGauge from "./ScoreGauge";

export interface BestRouteBannerProps {
  routes: RouteCandidate[];
  onNewSearch: () => void;
}

export default function BestRouteBanner({ routes, onNewSearch }: BestRouteBannerProps) {
  if (routes.length === 0) return null;

  const best = routes[findBestRouteIndex(routes)];
  const recommendation = buildRecommendation(routes);

  return (
    <section aria-label="Ruta recomendada" className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <Badge tone="success">Recomendada</Badge>
          <p className="text-sm font-medium text-sand-800">{recommendation}</p>
          <p className="text-sm text-sand-600">
            {formatDistance(best.distanceKm)} · {formatDuration(best.durationMinutes)}
          </p>
        </div>
        <ScoreGauge score={best.riskScore} className="w-full max-w-xs shrink-0" />
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onNewSearch}>
          Nueva búsqueda
        </Button>
      </div>
    </section>
  );
}