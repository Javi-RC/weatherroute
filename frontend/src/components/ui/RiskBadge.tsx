import type { IconType } from "react-icons";
import { FaCheckCircle, FaExclamation, FaExclamationTriangle, FaTimesCircle } from "react-icons/fa";
import { RISK_COLORS, riskLevelLabel } from "../../i18n/risk";
import type { RiskLevel } from "../../types";

export interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

const RISK_ICONS: Record<RiskLevel, IconType> = {
  Low: FaCheckCircle,
  Moderate: FaExclamation,
  High: FaExclamationTriangle,
  Severe: FaTimesCircle,
};

export default function RiskBadge({ level, className }: RiskBadgeProps) {
  const Icon = RISK_ICONS[level];
  const colors = RISK_COLORS[level];

  return (
    <span
      className={["inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", className]
        .filter(Boolean)
        .join(" ")}
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      <Icon aria-hidden style={{ color: colors.base }} />
      {riskLevelLabel(level)}
    </span>
  );
}