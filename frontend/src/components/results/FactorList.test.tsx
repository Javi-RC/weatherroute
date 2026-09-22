import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FactorList, { type FactorItem } from "./FactorList";
import { factorMeta, formatFactorValue, weightLabel } from "../../i18n/factors";

const KNOWN_TYPES = [
  "WIND",
  "TEMPERATURE",
  "HEAT",
  "RAIN",
  "STORM",
  "SNOW",
  "VISIBILITY",
  "UV",
] as const;

function factorOf(type: string, contribution = 20, extra: Partial<FactorItem> = {}): FactorItem {
  return { type, level: "MODERATE", contribution, message: type, ...extra };
}

describe("FactorList", () => {
  it("maps every known factor type to its Spanish label with a decorative icon", () => {
    const { container } = render(
      <FactorList factors={KNOWN_TYPES.map((type, i) => factorOf(type, 20 + i))} />,
    );
    for (const type of KNOWN_TYPES) {
      expect(screen.getByText(factorMeta(type).label)).toBeInTheDocument();
    }
    const icons = container.querySelectorAll("li svg");
    expect(icons).toHaveLength(KNOWN_TYPES.length);
    for (const icon of icons) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("falls back to Factor desconocido for unmapped factor types", () => {
    render(<FactorList factors={[factorOf("ASTEROID")]} />);
    expect(screen.getByText("Factor desconocido")).toBeInTheDocument();
  });

  it("renders the weight pill with the impact scale and the signed contribution", () => {
    render(<FactorList factors={[factorOf("WIND", 25), factorOf("SNOW", -15)]} />);
    expect(screen.getByText(`${weightLabel(25)} · +25`)).toBeInTheDocument();
    expect(screen.getByText(`${weightLabel(-15)} · -15`)).toBeInTheDocument();
  });

  it("renders the raw value text in Spanish when the metric is available", () => {
    render(
      <FactorList
        factors={[
          factorOf("WIND", 25, { raw: 32 }),
          factorOf("STORM", 40, { raw: 40 }),
        ]}
      />,
    );
    const windValue = formatFactorValue("WIND", 32);
    expect(windValue).not.toBeNull();
    expect(screen.getByText(windValue as string)).toBeInTheDocument();
    expect(screen.queryByText("40")).not.toBeInTheDocument();
  });

  it("shows the empty message when no factors are present", () => {
    render(<FactorList factors={[]} />);
    expect(screen.getByText("Sin factores de riesgo destacados.")).toBeInTheDocument();
  });

  it("omits the help trigger when onHowCalculated is absent", () => {
    render(<FactorList factors={[factorOf("WIND")]} />);
    expect(screen.queryByRole("button", { name: "¿Cómo se calcula?" })).not.toBeInTheDocument();
  });

  it("fires onHowCalculated when the help button is clicked", async () => {
    const user = userEvent.setup();
    const onHowCalculated = vi.fn();
    render(<FactorList factors={[factorOf("WIND")]} onHowCalculated={onHowCalculated} />);
    await user.click(screen.getByRole("button", { name: "¿Cómo se calcula?" }));
    expect(onHowCalculated).toHaveBeenCalledTimes(1);
  });
});