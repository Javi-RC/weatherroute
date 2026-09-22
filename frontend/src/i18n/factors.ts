import {
  FaBolt,
  FaCloudRain,
  FaEye,
  FaQuestion,
  FaSnowflake,
  FaSun,
  FaThermometerFull,
  FaThermometerHalf,
  FaWind,
} from "react-icons/fa";
import type { IconType } from "react-icons";

export type FactorType =
  | "WIND"
  | "TEMPERATURE"
  | "HEAT"
  | "RAIN"
  | "STORM"
  | "SNOW"
  | "VISIBILITY"
  | "UV";

export interface FactorMeta {
  label: string;
  icon: IconType;
}

export const FACTOR_META: Record<FactorType, FactorMeta> = {
  WIND: { label: "Viento", icon: FaWind },
  TEMPERATURE: { label: "Temperatura", icon: FaThermometerHalf },
  HEAT: { label: "Calor", icon: FaThermometerFull },
  RAIN: { label: "Lluvia", icon: FaCloudRain },
  STORM: { label: "Tormenta", icon: FaBolt },
  SNOW: { label: "Nieve", icon: FaSnowflake },
  VISIBILITY: { label: "Visibilidad", icon: FaEye },
  UV: { label: "Radiación UV", icon: FaSun },
};

export const FACTOR_FALLBACK: FactorMeta = {
  label: "Factor desconocido",
  icon: FaQuestion,
};

export function factorMeta(type: string): FactorMeta {
  return FACTOR_META[type as FactorType] ?? FACTOR_FALLBACK;
}

export function weightLabel(contribution: number): string {
  const abs = Math.abs(contribution);
  if (abs >= 40) return "Gran impacto";
  if (abs >= 15) return "Moderado";
  return "Leve";
}

export function formatFactorValue(type: string, raw: number | null): string | null {
  if (raw === null || !Number.isFinite(raw)) return null;
  const value = Math.round(raw);
  switch (type) {
    case "WIND":
      return `${value} km/h`;
    case "TEMPERATURE":
    case "HEAT":
      return `${value} °C`;
    case "RAIN":
      return `${value}%`;
    case "VISIBILITY":
      return `${value} km`;
    case "UV":
      return `${value}`;
    default:
      return null;
  }
}