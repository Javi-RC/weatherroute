import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RISK_COLORS, riskLevelLabel } from "../../i18n/risk";
import type { RiskLevel } from "../../types";
import RiskBadge from "./RiskBadge";

const LEVELS: RiskLevel[] = ["Low", "Moderate", "High", "Severe"];

describe("RiskBadge", () => {
  it.each(LEVELS)("renders the Spanish label for %s", (level) => {
    render(<RiskBadge level={level} />);
    expect(screen.getByText(riskLevelLabel(level))).toBeInTheDocument();
  });

  it.each(LEVELS)("renders an icon next to the label for %s (never color alone)", (level) => {
    const { container } = render(<RiskBadge level={level} />);
    const icon = container.querySelector("svg");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("aria-hidden");
    expect(container.textContent).toContain(riskLevelLabel(level));
  });

  it.each(LEVELS)("applies the RISK_COLORS surface colors for %s", (level) => {
    const { container } = render(<RiskBadge level={level} />);
    const badge = screen.getByText(riskLevelLabel(level));
    const colors = RISK_COLORS[level];

    expect(badge).toHaveStyle({ backgroundColor: colors.bg, color: colors.text });
    expect(container.querySelector("svg")).toHaveStyle({ color: colors.base });
    expect(colors.bg).not.toBe(colors.base);
  });

  it("uses a distinct icon per risk level", () => {
    const icons = LEVELS.map((level) => {
      const { container, unmount } = render(<RiskBadge level={level} />);
      const html = container.querySelector("svg")?.innerHTML ?? "";
      unmount();
      return html;
    });
    expect(new Set(icons).size).toBe(LEVELS.length);
  });
});