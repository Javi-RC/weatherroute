import { describe, expect, it } from "vitest";
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
import {
  FACTOR_FALLBACK,
  FACTOR_META,
  factorMeta,
  formatFactorValue,
  weightLabel,
} from "./factors";

const FACTOR_TYPES = [
  "WIND",
  "TEMPERATURE",
  "HEAT",
  "RAIN",
  "STORM",
  "SNOW",
  "VISIBILITY",
  "UV",
] as const;

describe("FACTOR_META", () => {
  it("maps every known factor.type to Spanish label and icon", () => {
    expect(FACTOR_META.WIND).toEqual({ label: "Viento", icon: FaWind });
    expect(FACTOR_META.TEMPERATURE).toEqual({
      label: "Temperatura",
      icon: FaThermometerHalf,
    });
    expect(FACTOR_META.HEAT).toEqual({ label: "Calor", icon: FaThermometerFull });
    expect(FACTOR_META.RAIN).toEqual({ label: "Lluvia", icon: FaCloudRain });
    expect(FACTOR_META.STORM).toEqual({ label: "Tormenta", icon: FaBolt });
    expect(FACTOR_META.SNOW).toEqual({ label: "Nieve", icon: FaSnowflake });
    expect(FACTOR_META.VISIBILITY).toEqual({
      label: "Visibilidad",
      icon: FaEye,
    });
    expect(FACTOR_META.UV).toEqual({ label: "Radiación UV", icon: FaSun });
  });

  it("never hits the fallback for real factor types", () => {
    for (const type of FACTOR_TYPES) {
      expect(factorMeta(type)).not.toBe(FACTOR_FALLBACK);
      expect(factorMeta(type).label).not.toBe("Factor desconocido");
    }
  });

  it("falls back for unknown factor types", () => {
    expect(FACTOR_FALLBACK).toEqual({ label: "Factor desconocido", icon: FaQuestion });
    expect(factorMeta("ASTEROID")).toEqual(FACTOR_FALLBACK);
  });
});

describe("weightLabel", () => {
  it("maps absolute contribution to impact bands (>=40, >=15)", () => {
    expect(weightLabel(40)).toBe("Gran impacto");
    expect(weightLabel(55)).toBe("Gran impacto");
    expect(weightLabel(-45)).toBe("Gran impacto");
    expect(weightLabel(15)).toBe("Moderado");
    expect(weightLabel(25)).toBe("Moderado");
    expect(weightLabel(-15)).toBe("Moderado");
    expect(weightLabel(0)).toBe("Leve");
    expect(weightLabel(14)).toBe("Leve");
    expect(weightLabel(-3)).toBe("Leve");
  });
});

describe("formatFactorValue", () => {
  it("formats a Spanish value string where a raw metric exists", () => {
    expect(formatFactorValue("WIND", 32)).toBe("32 km/h");
    expect(formatFactorValue("TEMPERATURE", 22)).toBe("22 °C");
    expect(formatFactorValue("HEAT", 38.6)).toBe("39 °C");
    expect(formatFactorValue("RAIN", 65)).toBe("65%");
    expect(formatFactorValue("VISIBILITY", 9)).toBe("9 km");
    expect(formatFactorValue("UV", 7)).toBe("7");
  });

  it("returns null when no raw metric applies or is missing", () => {
    expect(formatFactorValue("STORM", 40)).toBeNull();
    expect(formatFactorValue("SNOW", 30)).toBeNull();
    expect(formatFactorValue("UNKNOWN", 1)).toBeNull();
    expect(formatFactorValue("WIND", null)).toBeNull();
  });
});