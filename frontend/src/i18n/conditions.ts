import {
  FaBolt,
  FaCloud,
  FaCloudRain,
  FaQuestion,
  FaSmog,
  FaSnowflake,
  FaSun,
} from "react-icons/fa";
import type { IconType } from "react-icons";

export type Condition =
  | "Clear"
  | "Clouds"
  | "Fog"
  | "Rain"
  | "Snow"
  | "Storm"
  | "Unknown";

export interface ConditionMeta {
  label: string;
  icon: IconType;
  color: string;
}

export const CONDITION_META: Record<Condition, ConditionMeta> = {
  Clear: { label: "Despejado", icon: FaSun, color: "#f59e0b" },
  Clouds: { label: "Nublado", icon: FaCloud, color: "#78716c" },
  Fog: { label: "Niebla", icon: FaSmog, color: "#a8a29e" },
  Rain: { label: "Lluvia", icon: FaCloudRain, color: "#0891b2" },
  Snow: { label: "Nieve", icon: FaSnowflake, color: "#22d3ee" },
  Storm: { label: "Tormenta", icon: FaBolt, color: "#155e75" },
  Unknown: { label: "Sin datos", icon: FaQuestion, color: "#57534e" },
};

export function conditionMeta(condition: string): ConditionMeta {
  return CONDITION_META[condition as Condition] ?? CONDITION_META.Unknown;
}