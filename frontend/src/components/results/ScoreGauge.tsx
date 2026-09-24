import { formatScore } from "../../lib/format";
import { CONDITIONS_NOTE, conditionsLabel } from "../../i18n/risk";
import Tooltip from "../ui/Tooltip";

interface ScoreGaugeProps {
  score: number;
  onHowCalculated?: () => void;
  className?: string;
}

const HOW_CALCULATED_BUTTON = "¿Cómo se calcula?";
const HOW_CALCULATED_TIP = "Abrir la explicación del índice de condiciones";

const BAND_COLORS: Record<string, { fill: string; chip: string }> = {
  "Muy buenas": { fill: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800" },
  Buenas: { fill: "bg-amber-500", chip: "bg-amber-100 text-amber-800" },
  Aceptables: { fill: "bg-orange-500", chip: "bg-orange-100 text-orange-800" },
  Malas: { fill: "bg-red-500", chip: "bg-red-100 text-red-800" },
};

function bandColors(score: number) {
  return BAND_COLORS[conditionsLabel(score)] ?? BAND_COLORS["Malas"];
}

export default function ScoreGauge({ score, onHowCalculated, className }: ScoreGaugeProps) {
  const now = Math.round(Math.min(100, Math.max(0, score)));
  const { fill, chip } = bandColors(score);

  return (
    <div className={["space-y-2", className].filter(Boolean).join(" ")}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-sand-700">Índice de condiciones</h3>
        {onHowCalculated && (
          <Tooltip label={HOW_CALCULATED_TIP}>
            <button
              type="button"
              onClick={onHowCalculated}
              className="rounded text-xs font-semibold text-ocean-600 hover:text-ocean-800 focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-2"
            >
              {HOW_CALCULATED_BUTTON}
            </button>
          </Tooltip>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold leading-none text-sand-900">{formatScore(score)}</span>
        <span className={["rounded-full px-2 py-0.5 text-xs font-semibold", chip].join(" ")}>
          {conditionsLabel(score)}
        </span>
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={now}
        aria-label="Índice de condiciones"
        className="h-2.5 w-full overflow-hidden rounded-full bg-sand-200"
      >
        <div className={["h-full rounded-full motion-safe:transition-[width]", fill].join(" ")} style={{ width: `${now}%` }} />
      </div>
      <p className="text-xs text-sand-500">{CONDITIONS_NOTE}</p>
    </div>
  );
}