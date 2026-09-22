import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { buildRecommendation } from "../../i18n/recommendation";
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
  it("renders the Recomendada badge, the buildRecommendation text and a formatted summary", () => {
    const routes = [
      route(),
      route({ riskLevel: "Moderate", distanceKm: 9, durationMinutes: 40, riskScore: 55 }),
    ];
    render(<BestRouteBanner routes={routes} onNewSearch={vi.fn()} />);

    expect(screen.getByText("Recomendada")).toBeInTheDocument();
    expect(screen.getByText(buildRecommendation(routes)!)).toBeInTheDocument();
    expect(screen.getByText("12,5 km · 1 h 15 m")).toBeInTheDocument();
    expect(screen.getByText("88/100")).toBeInTheDocument();
    expect(screen.getByText("Muy buenas")).toBeInTheDocument();
  });

  it("uses the lower-risk route for the gauge and summary", () => {
    const routes = [
      route({ riskLevel: "Severe", distanceKm: 10, durationMinutes: 20, riskScore: 30 }),
      route({ riskLevel: "Low", distanceKm: 12.5, durationMinutes: 75, riskScore: 88 }),
    ];
    render(<BestRouteBanner routes={routes} onNewSearch={vi.fn()} />);

    expect(screen.getByText(buildRecommendation(routes)!)).toBeInTheDocument();
    expect(screen.getByText("12,5 km · 1 h 15 m")).toBeInTheDocument();
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