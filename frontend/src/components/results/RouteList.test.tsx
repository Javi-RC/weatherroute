import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RouteCandidate, RouteSegment } from "../../types";
import RouteList from "./RouteList";

function segment(overrides: Partial<RouteSegment> = {}): RouteSegment {
  return {
    fromIndex: 0,
    toIndex: 1,
    distanceKm: 10,
    arrivalTimeUtc: null,
    weather: { temperatureC: 20, windKmh: 8, precipitationProbability: 30, uvIndex: 3, visibilityKm: 10, condition: "Clear" },
    ...overrides,
  };
}

function route(index: number): RouteCandidate {
  return {
    providerId: `ors-${index}`,
    distanceKm: 28.6 + index,
    durationMinutes: 168,
    riskLevel: "Moderate",
    riskScore: 71 - index,
    factors: [],
    segments: [segment()],
    polyline: [],
  };
}

const threeRoutes = [route(0), route(1), route(2)];

function list(overrides: Partial<React.ComponentProps<typeof RouteList>> = {}) {
  return (
    <RouteList
      routes={threeRoutes}
      weatherAvailable
      selectedRouteId={null}
      onSelectRoute={vi.fn()}
      onNewSearch={vi.fn()}
      {...overrides}
    />
  );
}

describe("RouteList", () => {
  it("lists one entry per route", () => {
    render(list());

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("keeps the best-route banner above the list", () => {
    render(list({ routes: threeRoutes }));

    expect(screen.getByText("Recomendada")).toBeInTheDocument();
    expect(screen.getByTestId("route-list")).toBeInTheDocument();
  });

  it("moves the selection with the down arrow", async () => {
    const onSelectRoute = vi.fn();
    render(list({ selectedRouteId: 0, onSelectRoute }));
    screen.getAllByRole("button", { name: /Ruta 1/ })[0].focus();

    await userEvent.keyboard("{ArrowDown}");

    expect(onSelectRoute).toHaveBeenCalledWith(1);
  });

  it("wraps from the last route to the first", async () => {
    const onSelectRoute = vi.fn();
    render(list({ selectedRouteId: 2, onSelectRoute }));
    screen.getAllByRole("button", { name: /Ruta 3/ })[0].focus();

    await userEvent.keyboard("{ArrowDown}");

    expect(onSelectRoute).toHaveBeenCalledWith(0);
  });

  it("wraps from the first route to the last on the up arrow", async () => {
    const onSelectRoute = vi.fn();
    render(list({ selectedRouteId: 0, onSelectRoute }));
    screen.getAllByRole("button", { name: /Ruta 1/ })[0].focus();

    await userEvent.keyboard("{ArrowUp}");

    expect(onSelectRoute).toHaveBeenCalledWith(2);
  });

  it("moves focus with the selection", async () => {
    render(list({ selectedRouteId: 0 }));
    screen.getAllByRole("button", { name: /Ruta 1/ })[0].focus();

    await userEvent.keyboard("{ArrowDown}");

    expect(screen.getAllByRole("button", { name: /Ruta 2/ })[0]).toHaveFocus();
  });

  it("only the selected entry is in the tab order", () => {
    render(list({ selectedRouteId: 1 }));

    const buttons = screen.getAllByRole("button", { name: /Ruta \d/ });
    expect(buttons[0]).toHaveAttribute("tabindex", "-1");
    expect(buttons[1]).toHaveAttribute("tabindex", "0");
    expect(buttons[2]).toHaveAttribute("tabindex", "-1");
  });

  it("keeps the list reachable when nothing is selected", () => {
    render(list({ selectedRouteId: null }));

    const buttons = screen.getAllByRole("button", { name: /Ruta \d/ });
    expect(buttons[0]).toHaveAttribute("tabindex", "0");
    expect(buttons[1]).toHaveAttribute("tabindex", "-1");
  });

  it("no longer offers a per-card expand toggle", () => {
    render(list({ selectedRouteId: 0 }));

    expect(screen.queryByRole("button", { name: /Ampliar ruta/ })).not.toBeInTheDocument();
  });

  it("selects a route when its card is clicked", async () => {
    const onSelectRoute = vi.fn();
    render(list({ onSelectRoute }));

    await userEvent.click(screen.getAllByRole("button", { name: /Ruta 2/ })[0]);

    expect(onSelectRoute).toHaveBeenCalledWith(1);
  });
});
