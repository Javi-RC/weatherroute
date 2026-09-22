import { describe, expect, it } from "vitest";
import {
  FaBolt,
  FaCloud,
  FaCloudRain,
  FaQuestion,
  FaSmog,
  FaSnowflake,
  FaSun,
} from "react-icons/fa";
import { CONDITION_META, conditionMeta } from "./conditions";

const CONDITIONS = [
  "Clear",
  "Clouds",
  "Fog",
  "Rain",
  "Snow",
  "Storm",
  "Unknown",
] as const;

describe("CONDITION_META", () => {
  it("maps every known condition to Spanish label, icon and color", () => {
    expect(CONDITION_META.Clear).toEqual({
      label: "Despejado",
      icon: FaSun,
      color: "#f59e0b",
    });
    expect(CONDITION_META.Clouds).toEqual({
      label: "Nublado",
      icon: FaCloud,
      color: "#78716c",
    });
    expect(CONDITION_META.Fog).toEqual({
      label: "Niebla",
      icon: FaSmog,
      color: "#a8a29e",
    });
    expect(CONDITION_META.Rain).toEqual({
      label: "Lluvia",
      icon: FaCloudRain,
      color: "#0891b2",
    });
    expect(CONDITION_META.Snow).toEqual({
      label: "Nieve",
      icon: FaSnowflake,
      color: "#22d3ee",
    });
    expect(CONDITION_META.Storm).toEqual({
      label: "Tormenta",
      icon: FaBolt,
      color: "#155e75",
    });
    expect(CONDITION_META.Unknown).toEqual({
      label: "Sin datos",
      icon: FaQuestion,
      color: "#57534e",
    });
  });

  it("never resolves a real condition through the fallback path", () => {
    for (const condition of CONDITIONS) {
      expect(conditionMeta(condition)).toBeDefined();
    }
    for (const condition of CONDITIONS.filter((c) => c !== "Unknown")) {
      expect(conditionMeta(condition).label).not.toBe("Sin datos");
    }
  });

  it("falls back to 'Sin datos' for unknown conditions", () => {
    expect(conditionMeta("Drizzle")).toEqual(CONDITION_META.Unknown);
  });
});