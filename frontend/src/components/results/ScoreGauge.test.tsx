import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ScoreGauge from "./ScoreGauge";
import { CONDITIONS_NOTE, conditionsLabel } from "../../i18n/risk";
import { formatScore } from "../../lib/format";

function meterFill() {
  const meter = screen.getByRole("meter");
  return meter.firstElementChild as HTMLElement;
}

describe("ScoreGauge", () => {
  it("renders an accessible meter with the Índice attributes", () => {
    render(<ScoreGauge score={82} />);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "100");
    expect(meter).toHaveAttribute("aria-valuenow", "82");
    expect(meter).toHaveAttribute("aria-label", "Índice de condiciones");
  });

  it("shows the score number, band label and the conditions note", () => {
    render(<ScoreGauge score={82} />);
    expect(screen.getByText(formatScore(82))).toBeInTheDocument();
    expect(screen.getByText(conditionsLabel(82))).toBeInTheDocument();
    expect(screen.getByText(CONDITIONS_NOTE)).toBeInTheDocument();
    expect(screen.getByText("Índice de condiciones")).toBeInTheDocument();
  });

  it("fills the bar at score percent width and clamps out-of-range values", () => {
    const { rerender } = render(<ScoreGauge score={62} />);
    expect(meterFill()).toHaveStyle("width: 62%");
    rerender(<ScoreGauge score={140} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "100");
    expect(meterFill()).toHaveStyle("width: 100%");
    rerender(<ScoreGauge score={-5} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0");
  });

  it.each([
    { score: 80, label: "Muy buenas", fill: "bg-emerald-500" },
    { score: 60, label: "Buenas", fill: "bg-amber-500" },
    { score: 40, label: "Aceptables", fill: "bg-orange-500" },
    { score: 0, label: "Malas", fill: "bg-red-500" },
  ])("maps band threshold $score → $label with $fill", ({ score, label, fill }) => {
    render(<ScoreGauge score={score} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(meterFill()).toHaveClass(fill);
  });

  it("omits the ¿Cómo se calcula? trigger when onHowCalculated is absent", () => {
    render(<ScoreGauge score={72} />);
    expect(screen.queryByRole("button", { name: "¿Cómo se calcula?" })).not.toBeInTheDocument();
  });

  it("shows the trigger and fires onHowCalculated on click, with a tooltip", async () => {
    const user = userEvent.setup();
    const onHowCalculated = vi.fn();
    render(<ScoreGauge score={72} onHowCalculated={onHowCalculated} />);
    const button = screen.getByRole("button", { name: "¿Cómo se calcula?" });
    await user.hover(button);
    expect(screen.getByRole("tooltip")).toHaveAttribute("aria-hidden", "false");
    await user.click(button);
    expect(onHowCalculated).toHaveBeenCalledTimes(1);
  });
});