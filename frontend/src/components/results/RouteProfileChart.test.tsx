import { cloneElement, type ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RouteSegment } from "../../types";
import RouteProfileChart, { toProfilePoints } from "./RouteProfileChart";

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    // Stands in for the measurement ResponsiveContainer does in a real browser:
    // jsdom reports a 0x0 container, and a chart with no size renders nothing.
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number }> }) => (
      <div style={{ width: 600, height: 150 }}>{cloneElement(children, { width: 600, height: 150 })}</div>
    ),
  };
});

const segments: RouteSegment[] = [
  {
    fromIndex: 0,
    toIndex: 3,
    distanceKm: 4,
    arrivalTimeUtc: "2026-09-28T08:00:00Z",
    weather: { temperatureC: 18, windKmh: 8, precipitationProbability: 10, uvIndex: 3, visibilityKm: 12, condition: "Clear" },
  },
  {
    fromIndex: 3,
    toIndex: 6,
    distanceKm: 5,
    arrivalTimeUtc: "2026-09-28T08:24:00Z",
    weather: { temperatureC: 21, windKmh: 14, precipitationProbability: 40, uvIndex: 5, visibilityKm: 9, condition: "Clouds" },
  },
  {
    fromIndex: 6,
    toIndex: 9,
    distanceKm: 3,
    arrivalTimeUtc: null,
    weather: { temperatureC: 16, windKmh: 22, precipitationProbability: 75, uvIndex: 2, visibilityKm: 6, condition: "Rain" },
  },
];

describe("toProfilePoints", () => {
  it("accumulates the distance along the x axis", () => {
    const points = toProfilePoints(segments);

    expect(points.map((point) => point.distanceKm)).toEqual([4, 9, 12]);
    expect(points.map((point) => point.index)).toEqual([0, 1, 2]);
  });

  it("keeps one value per metric and nulls the missing weather", () => {
    const points = toProfilePoints([{ ...segments[0], weather: null }]);

    expect(points[0]).toMatchObject({ temperature: null, precipitation: null, wind: null });
  });

  it("labels the arrival time in UTC and falls back to a dash", () => {
    const points = toProfilePoints(segments);

    expect(points[0].arrivalLabel).toBe("08:00");
    expect(points[2].arrivalLabel).toBe("—");
  });
});

describe("RouteProfileChart", () => {
  it("describes the chart for assistive technology", () => {
    render(<RouteProfileChart segments={segments} onHoverSegment={vi.fn()} />);

    const figure = screen.getByRole("img");
    expect(figure).toHaveAccessibleName(/perfil meteorológico/i);
    expect(figure).toHaveAccessibleName(/temperatura en °C/i);
    expect(figure).toHaveAccessibleName(/3 tramos/i);
  });

  it("starts on temperature", () => {
    render(<RouteProfileChart segments={segments} onHoverSegment={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Temperatura" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Viento" })).toHaveAttribute("aria-pressed", "false");
  });

  it("switches the plotted metric", async () => {
    render(<RouteProfileChart segments={segments} onHoverSegment={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Viento" }));

    expect(screen.getByRole("button", { name: "Viento" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img")).toHaveAccessibleName(/viento en km\/h/i);
  });

  it("reports the hovered segment so the map can probe it", async () => {
    const onHoverSegment = vi.fn();
    const { container } = render(<RouteProfileChart segments={segments} onHoverSegment={onHoverSegment} />);

    const dots = container.querySelectorAll("circle");
    expect(dots.length).toBeGreaterThanOrEqual(3);

    await userEvent.hover(dots[1]);

    expect(onHoverSegment).toHaveBeenCalledWith(1);

    await userEvent.unhover(dots[1]);

    expect(onHoverSegment).toHaveBeenCalledWith(null);
  });

  it("renders only a note when there is no weather", () => {
    const { container } = render(
      <RouteProfileChart segments={segments.map((segment) => ({ ...segment, weather: null }))} onHoverSegment={vi.fn()} />,
    );

    expect(screen.getByText(/sin previsión/i)).toBeInTheDocument();
    expect(container.querySelector(".recharts-wrapper")).toBeNull();
  });
});
