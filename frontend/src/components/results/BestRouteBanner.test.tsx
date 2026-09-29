import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RouteCandidate } from "../../types";
import BestRouteBanner from "./BestRouteBanner";

function route(overrides: Partial<RouteCandidate> = {}): RouteCandidate {
  return {
    providerId: "ors",
    distanceKm: 12.5,
    durationMinutes: 75,
    riskLevel: "Low",
    riskScore: 88,
    factors: [],
    segments: [],
    polyline: [],
    ...overrides,
  };
}

describe("BestRouteBanner", () => {
  it("renders the Recomendada badge, the route number, the metrics line and the conditions index", () => {
    const routes = [
      route(),
      route({ riskLevel: "Moderate", distanceKm: 9, durationMinutes: 40, riskScore: 55 }),
    ];
    render(<BestRouteBanner routes={routes} onNewSearch={vi.fn()} />);

    expect(screen.getByText("Recomendada")).toBeInTheDocument();
    expect(screen.getByText("Ruta 1")).toBeInTheDocument();
    expect(screen.getByText("12,5 km · 1 h 15 min")).toBeInTheDocument();
    expect(screen.getByText("88/100")).toBeInTheDocument();
    expect(screen.getByText("Muy buenas")).toBeInTheDocument();
  });

  it("does not repeat the metrics in a second recommendation sentence", () => {
    const routes = [route({ distanceKm: 0.9, durationMinutes: 3, riskScore: 100 })];
    render(<BestRouteBanner routes={routes} onNewSearch={vi.fn()} />);

    expect(screen.getByText("0,9 km · 3 min")).toBeInTheDocument();
    expect(screen.queryByText(/recomendada:/i)).not.toBeInTheDocument();
  });

  it("uses the lower-risk route for the gauge and summary", () => {
    const routes = [
      route({ riskLevel: "Severe", distanceKm: 10, durationMinutes: 20, riskScore: 30 }),
      route({ riskLevel: "Low", distanceKm: 12.5, durationMinutes: 75, riskScore: 88 }),
    ];
    render(<BestRouteBanner routes={routes} onNewSearch={vi.fn()} />);

    expect(screen.getByText("12,5 km · 1 h 15 min")).toBeInTheDocument();
    expect(screen.getByText("88/100")).toBeInTheDocument();
    expect(screen.queryByText("30/100")).not.toBeInTheDocument();
  });

  it("renders nothing when there are no routes", () => {
    const { container } = render(<BestRouteBanner routes={[]} onNewSearch={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("runs onNewSearch from the Nueva búsqueda CTA", async () => {
    const user = userEvent.setup();
    const onNewSearch = vi.fn();
    render(<BestRouteBanner routes={[route()]} onNewSearch={onNewSearch} />);

    await user.click(screen.getByRole("button", { name: "Nueva búsqueda" }));
    expect(onNewSearch).toHaveBeenCalledTimes(1);
  });
});