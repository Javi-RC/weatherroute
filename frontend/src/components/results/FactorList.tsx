import type { RiskFactor } from "../../types";
import { factorMeta, formatFactorValue, weightLabel } from "../../i18n/factors";
import Badge from "../ui/Badge";
import Tooltip from "../ui/Tooltip";

export interface FactorItem extends RiskFactor {
  raw?: number | null;
}

interface FactorListProps {
  factors: FactorItem[];
  onHowCalculated?: () => void;
  className?: string;
}

const HOW_CALCULATED_BUTTON = "¿Cómo se calcula?";
const HOW_CALCULATED_TIP = "Abrir la explicación del índice de condiciones";

function signedContribution(contribution: number): string {
  return contribution > 0 ? `+${contribution}` : String(contribution);
}

function weightTone(contribution: number) {
  const abs = Math.abs(contribution);
  if (abs >= 40) return "danger";
  if (abs >= 15) return "warning";
  return "neutral";
}

export default function FactorList({ factors, onHowCalculated, className }: FactorListProps) {
  if (factors.length === 0) {
    return <p className="text-sm text-sand-500">Sin factores de riesgo destacados.</p>;
  }

  return (
    <div className={className}>
      <ul className="space-y-2">
        {factors.map((factor, i) => {
          const meta = factorMeta(factor.type);
          const Icon = meta.icon;
          const value = formatFactorValue(factor.type, factor.raw ?? null);
          return (
            <li
              key={`${factor.type}-${i}`}
              className="flex items-center justify-between gap-3 rounded-lg bg-sand-50 px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon aria-hidden className="shrink-0 text-sand-500" />
                <span className="truncate text-sm font-medium text-sand-800">{meta.label}</span>
                {value && <span className="truncate text-sm text-sand-500">{value}</span>}
              </span>
              <Badge tone={weightTone(factor.contribution)}>
                {weightLabel(factor.contribution)} · {signedContribution(factor.contribution)}
              </Badge>
            </li>
          );
        })}
      </ul>
      {onHowCalculated && (
        <div className="mt-3">
          <Tooltip label={HOW_CALCULATED_TIP}>
            <button
              type="button"
              onClick={onHowCalculated}
              className="rounded text-xs font-semibold text-ocean-600 hover:text-ocean-800 focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-2"
            >
              {HOW_CALCULATED_BUTTON}
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}