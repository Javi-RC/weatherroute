import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RouteCandidate, RouteSegment } from "../../types";
import ResultsLayer, { type ResultsLayerProps } from "./ResultsLayer";

const WEATHER_UNAVAILABLE_MESSAGE = "No hay previsión meteorológica para esa fecha — máximo 7 días.";
const ROUTE_UNAVAILABLE_MESSAGE = "El servicio de rutas no está disponible temporalmente.";

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
    factors: [{ type: "RAIN", level: "Moderate", contribution: 18, message: "Lluvia moderada" }],
    segments: [
      segment({
        weather: { temperatureC: 20, windKmh: 25, precipitationProbability: 65, uvIndex: 4, visibilityKm: 9, condition: "Rain" },
      }),
    ],
    polyline: [],
    ...overrides,
  };
}

function props(overrides: Partial<ResultsLayerProps> = {}): ResultsLayerProps {
  return {
    viewState: "full",
    routes: [route()],
    weatherAvailable: true,
    routeAvailable: true,
    selectedRouteId: null,
    expandedRouteId: null,
    onSelectRoute: vi.fn(),
    onToggleExpand: vi.fn(),
    onCloseDetail: vi.fn(),
    onRetry: vi.fn(),
    onNewSearch: vi.fn(),
    error: null,
    ...overrides,
  };
}

describe("ResultsLayer", () => {
  it("renders nothing while idle", () => {
    const { container } = render(<ResultsLayer {...props({ viewState: "idle", routes: [] })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders LoadingState while loading", () => {
    render(<ResultsLayer {...props({ viewState: "loading", routes: [] })} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders ErrorState with the forwarded message and retries", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <ResultsLayer
        {...props({ viewState: "error", routes: [], error: "El servicio no responde.", onRetry })}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("El servicio no responde.");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders the weather-unavailable banner but still lists the routes", () => {
    render(<ResultsLayer {...props({ viewState: "partial", weatherAvailable: false })} />);

    expect(screen.getByText(WEATHER_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText("Recomendada")).toBeInTheDocument();
    expect(screen.getByText("Ruta 1")).toBeInTheDocument();
    expect(screen.queryByText(ROUTE_UNAVAILABLE_MESSAGE)).not.toBeInTheDocument();
    expect(screen.queryByText("Lluvia máx.")).not.toBeInTheDocument();
  });

  it("renders the route-service-unavailable banner", () => {
    render(
      <ResultsLayer
        {...props({ viewState: "partial", routeAvailable: false, routes: [] })}
      />,
    );

    expect(screen.getByText(ROUTE_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(WEATHER_UNAVAILABLE_MESSAGE)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva búsqueda" })).toBeInTheDocument();
  });

  it("renders the recommended banner and cards on a full result without partial banners", () => {
    render(<ResultsLayer {...props({ viewState: "full" })} />);

    expect(screen.getByText("Recomendada")).toBeInTheDocument();
    expect(screen.getByText("Ruta 1")).toBeInTheDocument();
    expect(screen.queryByText(WEATHER_UNAVAILABLE_MESSAGE)).not.toBeInTheDocument();
    expect(screen.queryByText(ROUTE_UNAVAILABLE_MESSAGE)).not.toBeInTheDocument();
  });

  it("selects a route with the map-shared index when a card is clicked", async () => {
    const user = userEvent.setup();
    const onSelectRoute = vi.fn();
    render(
      <ResultsLayer {...props({ viewState: "full", routes: [route(), route({ providerId: "ors-alt", distanceKm: 30 })], onSelectRoute })} />,
    );

    await user.click(screen.getByRole("button", { name: /Ruta 2/ }));
    expect(onSelectRoute).toHaveBeenCalledWith(1);
  });

  it("expands and collapses a route detail through the controlled props", async () => {
    const user = userEvent.setup();
    const onToggleExpand = vi.fn();
    const { rerender } = render(
      <ResultsLayer {...props({ viewState: "full", expandedRouteId: null, onToggleExpand })} />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ampliar ruta" }));
    expect(onToggleExpand).toHaveBeenCalledWith(0);

    rerender(
      <ResultsLayer {...props({ viewState: "full", expandedRouteId: 0 })} />,
    );
    const dialog = screen.getByRole("dialog", { name: "Ruta 1" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("meter", { name: "Índice de condiciones" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Contraer ruta" }));
    rerender(
      <ResultsLayer {...props({ viewState: "full", expandedRouteId: null })} />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("highlights the selected card", () => {
    render(<ResultsLayer {...props({ viewState: "full", selectedRouteId: 0 })} />);

    const card = document.querySelector("[data-route-card]");
    expect(card).toHaveAttribute("data-selected", "true");
  });
});