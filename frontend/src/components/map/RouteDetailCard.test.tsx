import { cloneElement, type ReactElement } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RouteCandidate, RouteSegment } from "../../types";
import RouteDetailCard from "./RouteDetailCard";

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number }> }) => (
      <div style={{ width: 400, height: 150 }}>{cloneElement(children, { width: 400, height: 150 })}</div>
    ),
  };
});

const WEATHER_WARNING = "Detalles meteorológicos no disponibles — máximo 7 días de previsión.";

function segment(overrides: Partial<RouteSegment> = {}): RouteSegment {
  return {
    fromIndex: 0,
    toIndex: 1,
    distanceKm: 10,
    arrivalTimeUtc: new Date(Date.UTC(2026, 8, 28, 8, 0)).toISOString(),
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
      segment({
        fromIndex: 1,
        toIndex: 2,
        distanceKm: 2.5,
        weather: { temperatureC: 19, windKmh: 24, precipitationProbability: 65, uvIndex: 2, visibilityKm: 7, condition: "Rain" },
      }),
    ],
    polyline: [],
    ...overrides,
  };
}

function renderCard(props: Partial<React.ComponentProps<typeof RouteDetailCard>> = {}) {
  return render(
    <RouteDetailCard
      route={route()}
      onHoverSegment={vi.fn()}
      onClose={vi.fn()}
      onHowCalculated={vi.fn()}
      {...props}
    />,
  );
}

describe("RouteDetailCard", () => {
  it("shows the selected route with its score and profile", () => {
    renderCard();

    const card = screen.getByRole("region", { name: "Detalle de la ruta seleccionada" });
    expect(within(card).getByText(/88/)).toBeInTheDocument();
    expect(within(card).getByRole("img", { name: /perfil meteorológico/i })).toBeInTheDocument();
  });

  it("names the provider, the distance and the duration in the header", () => {
    renderCard();

    expect(screen.getByRole("heading", { name: /ors/i })).toHaveTextContent("12,5 km");
    expect(screen.getByRole("heading", { name: /ors/i })).toHaveTextContent("1 h 15 m");
  });

  it("lists the risk factors and the per-segment weather", () => {
    renderCard();

    // "Viento" is also a profile metric button, so the factor is asserted through
    // its contribution badge instead of its label.
    expect(screen.getByText("Moderado · +20")).toBeInTheDocument();
    expect(screen.getByText("Despejado")).toBeInTheDocument();
    expect(screen.getByText("24 km/h")).toBeInTheDocument();
    expect(screen.getAllByText("Llegada")).toHaveLength(2);
  });

  it("renders nothing when no route is selected", () => {
    const { container } = renderCard({ route: null });

    expect(container).toBeEmptyDOMElement();
  });

  it("closes through onClose", async () => {
    const onClose = vi.fn();
    renderCard({ onClose });

    await userEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens the score explanation through onHowCalculated", async () => {
    const onHowCalculated = vi.fn();
    renderCard({ onHowCalculated });

    await userEvent.click(screen.getByRole("button", { name: /cómo se calcula/i }));

    expect(onHowCalculated).toHaveBeenCalledTimes(1);
  });

  it("forwards the profile hover to the map so the map can probe the segment", async () => {
    const onHoverSegment = vi.fn();
    const { container } = renderCard({ onHoverSegment });

    const dots = container.querySelectorAll("circle");
    expect(dots.length).toBeGreaterThanOrEqual(2);

    await userEvent.hover(dots[1]);

    expect(onHoverSegment).toHaveBeenCalledWith(1);
  });

  it("warns about missing weather but keeps the segments", () => {
    renderCard({ weatherAvailable: false });

    expect(screen.getByText(WEATHER_WARNING)).toBeInTheDocument();
    expect(screen.getAllByText(/Llegada/)).toHaveLength(2);
  });
});
