import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RouteCandidate, RouteSegment } from "../../types";
import RouteCard from "./RouteCard";

function segment(overrides: Partial<RouteSegment> = {}): RouteSegment {
  return {
    fromIndex: 0,
    toIndex: 1,
    distanceKm: 10,
    arrivalTimeUtc: null,
    weather: null,
    ...overrides,
  };
}

function route(overrides: Partial<RouteCandidate> = {}): RouteCandidate {
  return {
    providerId: "ors",
    distanceKm: 28.6,
    durationMinutes: 168,
    riskLevel: "Moderate",
    riskScore: 71,
    factors: [],
    segments: [
      segment({
        weather: { temperatureC: 20, windKmh: 15, precipitationProbability: 80, uvIndex: 5, visibilityKm: 10, condition: "Rain" },
      }),
      segment({
        weather: { temperatureC: 18, windKmh: 40, precipitationProbability: 30, uvIndex: 3, visibilityKm: 8, condition: "Rain" },
      }),
    ],
    polyline: [],
    ...overrides,
  };
}

const base = {
  isSelected: false,
  hasSelection: false,
  weatherAvailable: true,
  onSelect: vi.fn(),
};

describe("RouteCard", () => {
  it("renders the map-matching route number and the mini-stats", () => {
    render(<RouteCard index={0} route={route()} {...base} />);

    expect(screen.getByText("Ruta 1")).toBeInTheDocument();
    expect(screen.getByText("28,6 km")).toBeInTheDocument();
    expect(screen.getByText("2 h 48 min")).toBeInTheDocument();
    expect(screen.getByText("80 %")).toBeInTheDocument();
    expect(screen.getByText("40 km/h")).toBeInTheDocument();
    expect(screen.getByText("71/100")).toBeInTheDocument();
  });

  it("selects the route with the same index the map uses", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<RouteCard index={1} route={route()} isSelected={false} hasSelection={false} weatherAvailable onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: /Ruta 2/ }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("marks the selected card with a highlight and data-selected", () => {
    const { container } = render(
      <RouteCard index={0} route={route()} isSelected hasSelection weatherAvailable onSelect={vi.fn()} />,
    );

    const card = container.querySelector("[data-route-card]");
    expect(card).toHaveAttribute("data-selected", "true");
    expect(card).toHaveClass("ring-2", "ring-ocean-600");
  });

  it("keeps only the selected card in the tab order", () => {
    const { rerender } = render(
      <RouteCard index={1} route={route()} isSelected hasSelection weatherAvailable onSelect={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /Ruta 2/ })).toHaveAttribute("tabindex", "0");

    rerender(<RouteCard index={1} route={route()} isSelected={false} hasSelection weatherAvailable onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Ruta 2/ })).toHaveAttribute("tabindex", "-1");
  });

  it("puts the first card in the tab order when nothing is selected", () => {
    render(<RouteCard index={0} route={route()} isSelected={false} hasSelection={false} weatherAvailable onSelect={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Ruta 1/ })).toHaveAttribute("tabindex", "0");
  });

  it("forwards the keyboard handler used for arrow navigation", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    render(<RouteCard index={0} route={route()} isSelected={false} hasSelection={false} weatherAvailable onSelect={vi.fn()} onKeyDown={onKeyDown} />);

    screen.getByRole("button", { name: /Ruta 1/ }).focus();
    await user.keyboard("{ArrowDown}");

    expect(onKeyDown).toHaveBeenCalled();
  });

  it("omits the rain/wind mini-stats when weather is unavailable", () => {
    render(<RouteCard index={0} route={route()} isSelected={false} hasSelection={false} weatherAvailable={false} onSelect={vi.fn()} />);

    expect(screen.queryByText("Lluvia máx.")).not.toBeInTheDocument();
    expect(screen.queryByText("Viento máx.")).not.toBeInTheDocument();
    expect(screen.getByText("Distancia")).toBeInTheDocument();
    expect(screen.getByText("Duración")).toBeInTheDocument();
    expect(screen.getByText("Índice")).toBeInTheDocument();
  });
});