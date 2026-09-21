import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RiskBreakdown from "./RiskBreakdown";

describe("RiskBreakdown", () => {
  it("renders score and factor with contribution", () => {
    render(
      <RiskBreakdown
        score={68}
        level="Moderate"
        factors={[{ type: "WIND", level: "HIGH", contribution: 25, message: "Wind 32 km/h" }]}
      />,
    );
    expect(
      screen.getByText((_, element) => /^68 \/ 100 · Moderate$/.test(element?.textContent ?? "")),
    ).toBeInTheDocument();
    expect(screen.getByText("Wind 32 km/h")).toBeInTheDocument();
    expect(screen.getByText("+25")).toBeInTheDocument();
  });
});
