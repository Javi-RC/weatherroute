import { useEffect, useState } from "react";
import type { RouteCandidate } from "../../types";
import Sheet from "../ui/Sheet";
import FactorList from "./FactorList";
import ScoreGauge from "./ScoreGauge";
import SegmentStrip from "./SegmentStrip";

export interface RouteDetailProps {
  route: RouteCandidate;
  index: number;
  weatherAvailable: boolean;
  isCompact?: boolean;
  onClose?: () => void;
  onHowCalculated?: () => void;
}

const MOBILE_BREAKPOINT = "(min-width: 768px)";
const WEATHER_WARNING = "Detalles meteorológicos no disponibles — máximo 7 días de previsión.";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export default function RouteDetail({
  route,
  index,
  weatherAvailable,
  isCompact,
  onClose,
  onHowCalculated,
}: RouteDetailProps) {
  const compact = isCompact ?? !useMediaQuery(MOBILE_BREAKPOINT);

  const content = (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <ScoreGauge score={route.riskScore} onHowCalculated={onHowCalculated} />
        <FactorList factors={route.factors} onHowCalculated={onHowCalculated} />
      </div>
      {!weatherAvailable && (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          {WEATHER_WARNING}
        </p>
      )}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-sand-700">Tramos</h3>
        <SegmentStrip segments={route.segments} />
      </div>
    </div>
  );

  if (compact) {
    return (
      <Sheet open position="bottom" title={`Ruta ${index + 1}`} onClose={onClose ?? (() => {})}>
        {content}
      </Sheet>
    );
  }

  return (
    <section data-testid="route-detail-panel" aria-label={`Detalle de la ruta ${index + 1}`}>
      {content}
    </section>
  );
}