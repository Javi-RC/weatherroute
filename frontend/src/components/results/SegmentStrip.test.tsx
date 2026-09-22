import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SegmentStrip from "./SegmentStrip";
import type { ExternalWeather, RouteSegment } from "../../types";

function segment(overrides: Partial<RouteSegment> = {}): RouteSegment {
  return {
    fromIndex: 0,
    toIndex: 1,
    distanceKm: 10,
    arrivalTimeUtc: new Date(Date.UTC(2026, 8, 22, 16, 0)).toISOString(),
    weather: null,
    ...overrides,
  };
}

function weather(overrides: Partial<ExternalWeather> = {}): ExternalWeather {
  return {
    temperatureC: 22,
    windKmh: null,
    precipitationProbability: null,
    uvIndex: null,
    visibilityKm: null,
    condition: "Clear",
    ...overrides,
  };
}

function localClock(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

describe("SegmentStrip", () => {
  it("renders the local arrival clock time per segment", () => {
    const first = new Date(Date.UTC(2026, 8, 22, 16, 0));
    const second = new Date(Date.UTC(2026, 8, 22, 16, 30));
    render(
      <SegmentStrip
        segments={[segment({ arrivalTimeUtc: first.toISOString() }), segment({ arrivalTimeUtc: second.toISOString() })]}
      />,
    );
    expect(screen.getByText(localClock(first))).toBeInTheDocument();
    expect(screen.getByText(localClock(second))).toBeInTheDocument();
  });

  it("falls back to the segment number when arrival is missing", () => {
    render(<SegmentStrip segments={[segment({ arrivalTimeUtc: null })]} />);
    expect(screen.getByText("T1")).toBeInTheDocument();
  });

  it("renders a decorative condition icon and label per distinct condition", () => {
    const { container } = render(
      <SegmentStrip
        segments={[
          segment({ weather: { ...weather(), condition: "Clear" } }),
          segment({ weather: { ...weather(), condition: "Rain" } }),
          segment({ weather: { ...weather(), condition: "Storm" } }),
        ]}
      />,
    );
    expect(screen.getByText("Despejado")).toBeInTheDocument();
    expect(screen.getByText("Lluvia")).toBeInTheDocument();
    expect(screen.getByText("Tormenta")).toBeInTheDocument();
    const icons = container.querySelectorAll("li svg");
    expect(icons).toHaveLength(3);
    for (const icon of icons) expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the temperature per segment", () => {
    render(<SegmentStrip segments={[segment({ weather: weather({ temperatureC: 22 }) })]} />);
    expect(screen.getByText("22 °C")).toBeInTheDocument();
  });

  it("shows mini rain/wind indicators whose tooltip carries full detail", async () => {
    const user = userEvent.setup();
    const w = weather({
      condition: "Rain",
      windKmh: 20,
      precipitationProbability: 40,
      uvIndex: 5,
      visibilityKm: 9,
    });
    render(<SegmentStrip segments={[segment({ weather: w })]} />);
    expect(screen.getByText("40 %")).toBeInTheDocument();
    expect(screen.getByText("20 km/h")).toBeInTheDocument();

    const trigger = screen.getByLabelText(
      /^Viento 20 km\/h · UV 5 · Visibilidad 9 km · Lluvia 40 % · Condición: Lluvia$/,
    );
    await user.hover(trigger);
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveAttribute("aria-hidden", "false");
    expect(tip).toHaveTextContent("Viento 20 km/h");
    expect(tip).toHaveTextContent("UV 5");
    expect(tip).toHaveTextContent("Visibilidad 9 km");
    expect(tip).toHaveTextContent("Lluvia 40 %");
    expect(tip).toHaveTextContent("Condición: Lluvia");
  });

  it("uses list semantics and stacks tiles vertically on mobile, horizontally from md", () => {
    render(
      <SegmentStrip
        segments={[segment({ weather: weather({ condition: "Clear" }) }), segment({ weather: weather({ condition: "Rain" }) })]}
      />,
    );
    const list = screen.getByRole("list");
    expect(list).toHaveClass("flex-col", "md:flex-row");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("handles segments without weather data", () => {
    render(<SegmentStrip segments={[segment({ weather: null })]} />);
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
    expect(screen.getByText("Sin datos meteorológicos")).toBeInTheDocument();
  });
});