import type { IconType } from "react-icons";
import { FaCheckCircle, FaExclamation, FaExclamationTriangle, FaTimesCircle } from "react-icons/fa";
import { RISK_COLORS, riskLevelLabel } from "../../i18n/risk";
import type { RiskLevel } from "../../types";

const RISK_LEVELS: RiskLevel[] = ["Low", "Moderate", "High", "Severe"];

const RISK_ICONS: Record<RiskLevel, IconType> = {
  Low: FaCheckCircle,
  Moderate: FaExclamation,
  High: FaExclamationTriangle,
  Severe: FaTimesCircle,
};

export default function MapLegend() {
  return (
    <div
      aria-label="Leyenda de riesgo"
      className="pointer-events-none absolute bottom-4 left-4 z-[1] select-none rounded-lg bg-white/90 p-2 shadow-card backdrop-blur"
    >
      <h2 className="sr-only">Leyenda de riesgo</h2>
      <ul className="flex flex-col gap-1">
        {RISK_LEVELS.map((level) => {
          const colors = RISK_COLORS[level];
          const Icon = RISK_ICONS[level];
          return (
            <li key={level} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: colors.base }}
              />
              <Icon aria-hidden="true" style={{ color: colors.base }} className="shrink-0 text-sm" />
              <span className="sr-only text-xs font-medium text-sand-900 sm:not-sr-only">
                {riskLevelLabel(level)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}