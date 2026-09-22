import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { RiskLevel } from "../types";
import {
  CONDITIONS_NOTE,
  RISK_COLORS,
  conditionsLabel,
  riskLevelLabel,
} from "./risk";

const RISK_LEVELS: RiskLevel[] = ["Low", "Moderate", "High", "Severe"];

describe("riskLevelLabel", () => {
  it("maps every known RiskLevel to a Spanish label", () => {
    expect(riskLevelLabel("Low")).toBe("Riesgo bajo");
    expect(riskLevelLabel("Moderate")).toBe("Riesgo moderado");
    expect(riskLevelLabel("High")).toBe("Riesgo alto");
    expect(riskLevelLabel("Severe")).toBe("Riesgo extremo");
  });

  it("never returns the fallback for real risk levels", () => {
    for (const level of RISK_LEVELS) {
      expect(riskLevelLabel(level)).not.toBe("Riesgo");
    }
  });

  it("falls back to 'Riesgo' for unknown levels", () => {
    expect(riskLevelLabel("Catastrophic")).toBe("Riesgo");
  });
});

describe("RISK_COLORS", () => {
  it("defines base/bg/text hexes for every known RiskLevel", () => {
    for (const level of RISK_LEVELS) {
      expect(RISK_COLORS[level].base).toMatch(/^#[0-9a-f]{6}$/i);
      expect(RISK_COLORS[level].bg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(RISK_COLORS[level].text).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("text/bg pairs pass WCAG 4.5:1 contrast", () => {
    for (const level of RISK_LEVELS) {
      const { text, bg } = RISK_COLORS[level];
      expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("index.css @theme risk tokens mirror RISK_COLORS exactly", () => {
    const css = readFileSync(resolve(import.meta.dirname, "../index.css"), "utf8");
    const cssTokens = parseRiskTokens(css);
    const expected: Record<string, string> = {};
    for (const level of RISK_LEVELS) {
      expect(cssTokens[`${level}.base`]).toBeDefined();
      expect(cssTokens[`${level}.bg`]).toBeDefined();
      expect(cssTokens[`${level}.text`]).toBeDefined();
      expected[`${level}.base`] = RISK_COLORS[level].base.toLowerCase();
      expected[`${level}.bg`] = RISK_COLORS[level].bg.toLowerCase();
      expected[`${level}.text`] = RISK_COLORS[level].text.toLowerCase();
    }
    expect(cssTokens).toEqual(expected);
  });
});

describe("conditionsLabel", () => {
  it("labels the score bands in Spanish", () => {
    expect(conditionsLabel(88)).toBe("Muy buenas");
    expect(conditionsLabel(75)).toBe("Buenas");
    expect(conditionsLabel(55)).toBe("Aceptables");
    expect(conditionsLabel(30)).toBe("Malas");
  });

  it("is monotonic at the thresholds (>=80, >=60, >=40)", () => {
    expect(conditionsLabel(80)).toBe("Muy buenas");
    expect(conditionsLabel(79)).toBe("Buenas");
    expect(conditionsLabel(60)).toBe("Buenas");
    expect(conditionsLabel(59)).toBe("Aceptables");
    expect(conditionsLabel(40)).toBe("Aceptables");
    expect(conditionsLabel(39)).toBe("Malas");
    expect(conditionsLabel(0)).toBe("Malas");
  });

  it("exposes the help note", () => {
    expect(CONDITIONS_NOTE).toBe("Más alto = mejores condiciones");
  });
});

function parseRiskTokens(css: string): Record<string, string> {
  const levels: Record<string, RiskLevel> = {
    low: "Low",
    moderate: "Moderate",
    high: "High",
    severe: "Severe",
  };
  const tokens: Record<string, string> = {};
  const regex =
    /--color-risk-(low|moderate|high|severe)(?:-(bg|text))?:\s*(#[0-9a-fA-F]{6})/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(css)) !== null) {
    const level = levels[match[1]];
    const key = match[2] ?? "base";
    tokens[`${level}.${key}`] = match[3].toLowerCase();
  }
  return tokens;
}

function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const channel = c / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}