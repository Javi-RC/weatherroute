import type { RiskLevel } from "../types";

export interface RiskColor {
  base: string;
  bg: string;
  text: string;
}

const RISK_LABELS: Record<RiskLevel, string> = {
  Low: "Riesgo bajo",
  Moderate: "Riesgo moderado",
  High: "Riesgo alto",
  Severe: "Riesgo extremo",
};

export const RISK_COLORS = {
  Low: { base: "#059669", bg: "#d1fae5", text: "#064e3b" },
  Moderate: { base: "#d97706", bg: "#fef3c7", text: "#78350f" },
  High: { base: "#ea580c", bg: "#ffedd5", text: "#7c2d12" },
  Severe: { base: "#dc2626", bg: "#fee2e2", text: "#7f1d1d" },
} as const satisfies Record<RiskLevel, RiskColor>;

export function riskLevelLabel(level: string): string {
  return RISK_LABELS[level as RiskLevel] ?? "Riesgo";
}

export function conditionsLabel(score: number): string {
  if (score >= 80) return "Muy buenas";
  if (score >= 60) return "Buenas";
  if (score >= 40) return "Aceptables";
  return "Malas";
}

export const CONDITIONS_NOTE = "Más alto = mejores condiciones";