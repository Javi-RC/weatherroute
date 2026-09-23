import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { Map as StubMap, Marker as StubMarker } from "../test/stubs/maplibre";
import type { RouteAnalysisResponse, RouteSegment } from "./types";

vi.mock("maplibre-gl", () => import("../test/stubs/maplibre"));

const WELCOME_TITLE = "Tu ruta, con el clima en cuenta";

function segment(overrides: Partial<RouteSegment> = {}): RouteSegment {
  return {
    fromIndex: 0,
    toIndex: 1,
    distanceKm: 8,
    arrivalTimeUtc: null,
    weather: {
      temperatureC: 14,
      windKmh: 10,
      precipitationProbability: 20,
      uvIndex: 3,
      visibilityKm: 12,
      condition: "Clear",
    },
    ...overrides,
  };
}

const ANALYSIS: RouteAnalysisResponse = {
  status: "full",
  weatherAvailable: true,
  routeAvailable: true,
  recommendation: "Ruta 1 recomendada: 16 km, 52 min, condiciones Muy buenas",
  routes: [
    {
      providerId: "ors",
      distanceKm: 16.2,
      durationMinutes: 52,
      riskLevel: "Low",
      riskScore: 88,
      factors: [{ type: "WIND", level: "Moderate", contribution: 12, message: "Viento moderado" }],
      segments: [segment()],
      polyline: [
        { latitude: 38.9861, longitude: -3.9292 },
        { latitude: 38.93, longitude: -3.9 },
      ],
    },
    {
      providerId: "ors-alt",
      distanceKm: 19.1,
      durationMinutes: 63,
      riskLevel: "Moderate",
      riskScore: 64,
      factors: [{ type: "RAIN", level: "Moderate", contribution: 18, message: "Lluvia moderada" }],
      segments: [segment({ distanceKm: 9 })],
      polyline: [
        { latitude: 38.9861, longitude: -3.9292 },
        { latitude: 38.95, longitude: -3.82 },
      ],
    },
  ],
};

function analysisResponse(): Response {
  return new Response(JSON.stringify(ANALYSIS), { status: 200 });
}

function geocodeResponse(): Response {
  return new Response(
    JSON.stringify({ coordinates: { lat: 38.9861, lon: -3.9292 } }),
    { status: 200 },
  );
}

function mockFetch(analyzeImpl: () => Response) {
  const calls = { analyze: 0, geocode: 0 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/routes/analyze")) {
        calls.analyze += 1;
        return analyzeImpl();
      }
      calls.geocode += 1;
      return geocodeResponse();
    }),
  );
  return calls;
}

function stubDesktopMedia() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.startsWith("(min-width:"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function renderApp() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

async function typeAndSearch() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/desde/i), "Ciudad Real");
  await user.type(screen.getByLabelText(/hasta/i), "Almagro");
  await user.click(screen.getByRole("button", { name: "Buscar ruta" }));
}

function emitLoad() {
  const map = StubMap.instances.at(-1)!;
  act(() => map._emit("load"));
}

beforeEach(() => {
  StubMap.reset();
  StubMarker.reset();
  stubDesktopMedia();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("is a map-centric shell: the map, the planner and the welcome overlay render before any search", async () => {
    renderApp();

    await waitFor(() => expect(StubMap.instances).toHaveLength(1));
    expect(screen.getByTestId("map-canvas")).toBeInTheDocument();
    expect(screen.getByText(WELCOME_TITLE)).toBeInTheDocument();
    expect(screen.getByLabelText(/desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buscar ruta" })).toBeInTheDocument();
    expect(screen.queryByTestId("route-list")).not.toBeInTheDocument();
    expect(screen.queryByText("Recomendada")).not.toBeInTheDocument();
  });

  it("shows the error state on a failed analysis and retries the same search", async () => {
    const calls = mockFetch(() => new Response(null, { status: 503 }));
    renderApp();

    await typeAndSearch();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Reintentar");
    expect(calls.analyze).toBe(1);

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(calls.analyze).toBe(2));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders the recommended banner, Spanish cards and the conditions index after a successful analysis", async () => {
    const calls = mockFetch(() => analysisResponse());
    renderApp();

    await typeAndSearch();

    expect(await screen.findByText("Recomendada")).toBeInTheDocument();
    expect(screen.getByText("Ruta 1")).toBeInTheDocument();
    expect(screen.getByText("Ruta 2")).toBeInTheDocument();
    expect(screen.getAllByText("Distancia").length).toBeGreaterThan(0);
    expect(screen.getByRole("meter", { name: "Índice de condiciones" })).toBeInTheDocument();
    expect(screen.queryByText(WELCOME_TITLE)).not.toBeInTheDocument();
    expect(calls.analyze).toBe(1);

    const bestCard = document.querySelector('[data-route-card][data-route-index="0"]');
    expect(bestCard).toHaveAttribute("data-selected", "true");

    emitLoad();
    const map = StubMap.instances.at(-1)!;
    expect(map.fitBoundsCalls.length).toBeGreaterThan(0);
    expect(StubMarker.instances.map((marker) => marker.element?.textContent)).toEqual(["A", "B"]);
  });

  it("renders an expanded route detail with the index meter when the card is expanded", async () => {
    mockFetch(() => analysisResponse());
    renderApp();

    await typeAndSearch();
    await screen.findByText("Recomendada");

    await userEvent.click(screen.getAllByRole("button", { name: "Ampliar ruta" })[0]);

    const card = document.querySelector('[data-route-card][data-route-index="0"]')!;
    expect(within(card as HTMLElement).getByRole("meter", { name: "Índice de condiciones" })).toBeInTheDocument();
  });
});