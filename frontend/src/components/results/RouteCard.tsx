import { useId, type ReactNode } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import { formatDistance, formatDuration, formatPercent, formatScore, formatWind } from "../../lib/format";
import type { RouteCandidate, RouteSegment } from "../../types";
import Card from "../ui/Card";
import IconButton from "../ui/IconButton";
import RiskBadge from "../ui/RiskBadge";

export interface RouteCardProps {
  index: number;
  route: RouteCandidate;
  isSelected: boolean;
  isExpanded: boolean;
  weatherAvailable: boolean;
  onSelect: (index: number) => void;
  onToggleExpand: (index: number) => void;
  children?: ReactNode;
}

function maxMetric(segments: RouteSegment[], pick: (segment: RouteSegment) => number | null): number | null {
  let max: number | null = null;
  for (const segment of segments) {
    const value = pick(segment);
    if (value == null) continue;
    if (max === null || value > max) max = value;
  }
  return max;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-sand-50 px-2.5 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-sand-400">{label}</dt>
      <dd className="text-sm font-semibold text-sand-900">{value}</dd>
    </div>
  );
}

export default function RouteCard({
  index,
  route,
  isSelected,
  isExpanded,
  weatherAvailable,
  onSelect,
  onToggleExpand,
  children,
}: RouteCardProps) {
  const detailId = useId();
  const maxRain = maxMetric(route.segments, (s) => s.weather?.precipitationProbability ?? null);
  const maxWind = maxMetric(route.segments, (s) => s.weather?.windKmh ?? null);

  return (
    <Card
      padding="md"
      data-route-card=""
      data-route-index={index}
      data-selected={isSelected}
      className={[
        "motion-safe:transition-shadow",
        isSelected ? "ring-2 ring-ocean-600" : "hover:ring-1 hover:ring-ocean-300",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onSelect(index)}
          aria-pressed={isSelected}
          className="-m-1 flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600 focus-visible:ring-offset-2"
        >
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ocean-600 text-sm font-bold text-white"
          >
            {index + 1}
          </span>
          <span className="min-w-0 space-y-1">
            <h3 className="truncate text-sm font-semibold text-sand-900">Ruta {index + 1}</h3>
            <RiskBadge level={route.riskLevel} />
          </span>
        </button>
        <IconButton
          label={isExpanded ? "Contraer ruta" : "Ampliar ruta"}
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? detailId : undefined}
          onClick={() => onToggleExpand(index)}
        >
          {isExpanded ? <FaChevronUp aria-hidden /> : <FaChevronDown aria-hidden />}
        </IconButton>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2">
        <MiniStat label="Distancia" value={formatDistance(route.distanceKm)} />
        <MiniStat label="Duración" value={formatDuration(route.durationMinutes)} />
        {weatherAvailable && (
          <MiniStat label="Lluvia máx." value={maxRain == null ? "—" : formatPercent(maxRain)} />
        )}
        {weatherAvailable && (
          <MiniStat label="Viento máx." value={maxWind == null ? "—" : formatWind(maxWind)} />
        )}
        <MiniStat label="Índice" value={formatScore(route.riskScore)} />
      </dl>

      {isExpanded && (
        <div id={detailId} className="mt-4 border-t border-sand-100 pt-4">
          {children}
        </div>
      )}
    </Card>
  );
}