import type { RouteCandidate } from "../../types";
import { findBestRouteIndex } from "../../i18n/recommendation";
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

  const bestIndex = findBestRouteIndex(routes);
  const best = routes[bestIndex];

  return (
    <section aria-label="Ruta recomendada" className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="success">Recomendada</Badge>
        <h2 className="text-sm font-semibold text-sand-800">Ruta {bestIndex + 1}</h2>
      </div>
      <p className="mt-2 text-sm text-sand-600">
        {formatDistance(best.distanceKm)} · {formatDuration(best.durationMinutes)}
      </p>
      <div className="mt-4 border-t border-emerald-100 pt-4">
        <ScoreGauge score={best.riskScore} className="w-full" />
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onNewSearch}>
          Nueva búsqueda
        </Button>
      </div>
    </section>
  );
}
