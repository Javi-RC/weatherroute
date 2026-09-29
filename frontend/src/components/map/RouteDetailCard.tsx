import { FaTimes } from "react-icons/fa";
import { formatDistance, formatDuration } from "../../lib/format";
import type { RouteCandidate } from "../../types";
import IconButton from "../ui/IconButton";
import FactorList from "../results/FactorList";
import RouteProfileChart from "../results/RouteProfileChart";
import ScoreGauge from "../results/ScoreGauge";
import SegmentStrip from "../results/SegmentStrip";

const WEATHER_WARNING = "Detalles meteorológicos no disponibles — máximo 7 días de previsión.";

export interface RouteDetailCardProps {
  route: RouteCandidate | null;
  weatherAvailable?: boolean;
  onHoverSegment: (index: number | null) => void;
  onClose: () => void;
  onHowCalculated: () => void;
}

export default function RouteDetailCard({
  route,
  weatherAvailable = true,
  onHoverSegment,
  onClose,
  onHowCalculated,
}: RouteDetailCardProps) {
  if (!route) return null;

  return (
    <section
      aria-label="Detalle de la ruta seleccionada"
      className="pointer-events-auto max-h-[70vh] w-[26rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-sand-200 bg-white/95 p-4 shadow-raise backdrop-blur"
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-sand-900">
          Ruta {route.providerId} · {formatDistance(route.distanceKm)} · {formatDuration(route.durationMinutes)}
        </h2>
        <IconButton label="Cerrar detalle" onClick={onClose}>
          <FaTimes aria-hidden />
        </IconButton>
      </header>
      <div className="mb-3">
        <ScoreGauge score={route.riskScore} onHowCalculated={onHowCalculated} />
      </div>
      <div className="mb-3">
        <RouteProfileChart segments={route.segments} onHoverSegment={onHoverSegment} />
      </div>
      {!weatherAvailable && (
        <p role="status" className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          {WEATHER_WARNING}
        </p>
      )}
      {route.factors.length > 0 && <FactorList factors={route.factors} />}
      <div className="mt-3">
        <h3 className="mb-2 text-sm font-semibold text-sand-700">Tramos</h3>
        <SegmentStrip segments={route.segments} />
      </div>
    </section>
  );
}
