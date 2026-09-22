import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RISK_COLORS, riskLevelLabel } from "../../i18n/risk";
import type { RiskLevel } from "../../types";
import MapLegend from "./MapLegend";

const RISK_LEVELS: RiskLevel[] = ["Low", "Moderate", "High", "Severe"];

function cssRgb(hex: string): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

describe("MapLegend", () => {
  it("renders the four risk levels with their Spanish labels", () => {
    render(<MapLegend />);

    for (const level of RISK_LEVELS) {
      expect(screen.getByText(riskLevelLabel(level))).toBeInTheDocument();
    }
  });

  it("marks color swatches and icons as decorative for screen readers", () => {
    const { container } = render(<MapLegend />);

    const decorative = container.querySelectorAll('[aria-hidden="true"]');
    expect(decorative.length).toBe(RISK_LEVELS.length * 2);
  });

  it("renders a swatch per level using the RISK_COLORS palette", () => {
    const { container } = render(<MapLegend />);

    const swatches = container.querySelectorAll("span[aria-hidden='true']");
    const bgColors = Array.from(swatches, (swatch) => (swatch as HTMLElement).style.backgroundColor);
    for (const level of RISK_LEVELS) {
      expect(bgColors).toContain(cssRgb(RISK_COLORS[level].base));
    }
  });

  it("keeps labels present but visually hidden on small screens and restored on sm+", () => {
    render(<MapLegend />);

    const label = screen.getByText(riskLevelLabel("Low"));
    expect(label.className).toContain("sr-only");
    expect(label.className).toContain("sm:not-sr-only");
  });

  it("exposes a readable legend heading for assistive tech", () => {
    render(<MapLegend />);

    expect(screen.getByRole("heading", { level: 2, name: "Leyenda de riesgo" })).toBeInTheDocument();
  });
});