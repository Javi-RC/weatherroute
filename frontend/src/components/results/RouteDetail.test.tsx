import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RouteCandidate, RouteSegment } from "../../types";
import RouteDetail from "./RouteDetail";

const WEATHER_WARNING = "Detalles meteorológicos no disponibles — máximo 7 días de previsión.";

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

function route(overrides: Partial<RouteCandidate> = {}): RouteCandidate {
  return {
    providerId: "ors",
    distanceKm: 12.5,
    durationMinutes: 75,
    riskLevel: "Low",
    riskScore: 88,
    factors: [{ type: "WIND", level: "Moderate", contribution: 20, message: "Viento fuerte" }],
    segments: [
      segment({
        weather: { temperatureC: 22, windKmh: 15, precipitationProbability: 20, uvIndex: 5, visibilityKm: 10, condition: "Clear" },
      }),
    ],
    polyline: [],
    ...overrides,
  };
}

describe("RouteDetail", () => {
  it("renders the score gauge, factors and segments inside a bottom Sheet on mobile", () => {
    render(<RouteDetail route={route()} index={0} weatherAvailable isCompact />);

    const dialog = screen.getByRole("dialog", { name: "Ruta 1" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("meter", { name: "Índice de condiciones" })).toBeInTheDocument();
    expect(within(dialog).getByText("88/100")).toBeInTheDocument();
    expect(within(dialog).getByText("Viento")).toBeInTheDocument();
    expect(within(dialog).getByText("Despejado")).toBeInTheDocument();
    expect(within(dialog).getByText("Tramos")).toBeInTheDocument();
  });

  it("renders an in-panel expansion on desktop instead of a dialog", () => {
    render(<RouteDetail route={route()} index={1} weatherAvailable isCompact={false} />);

    expect(screen.getByTestId("route-detail-panel")).toHaveAttribute(
      "aria-label",
      "Detalle de la ruta 2",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar" })).not.toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Índice de condiciones" })).toBeInTheDocument();
  });

  it("closes the mobile sheet through onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<RouteDetail route={route()} index={0} weatherAvailable isCompact onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the per-route weather warning when weather is unavailable", () => {
    render(<RouteDetail route={route()} index={0} weatherAvailable={false} isCompact={false} />);
    expect(screen.getByText(WEATHER_WARNING)).toBeInTheDocument();
  });

  it("hides the per-route weather warning when weather is available", () => {
    render(<RouteDetail route={route()} index={0} weatherAvailable isCompact={false} />);
    expect(screen.queryByText(WEATHER_WARNING)).not.toBeInTheDocument();
  });
});