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

function analysisVariant(distanceKm: number): RouteAnalysisResponse {
  return {
    ...ANALYSIS,
    routes: ANALYSIS.routes.map((route, index) =>
      index === 1 ? { ...route, distanceKm } : route,
    ),
  };
}

function analysisResponse(distanceKm?: number): Response {
  const body = distanceKm === undefined ? ANALYSIS : analysisVariant(distanceKm);
  return new Response(JSON.stringify(body), { status: 200 });
}

function geocodeResponse(): Response {
  return new Response(
    JSON.stringify({ coordinates: { lat: 38.9861, lon: -3.9292 } }),
    { status: 200 },
  );
}

function mockFetch(analyzeImpl: () => Response | Promise<Response>) {
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

  it("auto-refreshes with a debounced re-analysis when only the activity changes, keeping results visible and replacing them atomically", async () => {
    const user = userEvent.setup();
    let servedFirst = false;
    let resolveRefresh: (() => void) | undefined;
    const calls = mockFetch(() => {
      if (!servedFirst) {
        servedFirst = true;
        return analysisResponse();
      }
      return new Promise<Response>((resolve) => {
        resolveRefresh = () => resolve(analysisResponse(21.4));
      });
    });
    renderApp();

    await typeAndSearch();
    await screen.findByText("Recomendada");
    expect(screen.queryByText("Actualizando…")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Coche" }));
    await user.click(screen.getByRole("button", { name: "Buscar ruta" }));

    // debounced: exactly one new analyze request, previous results stay visible
    await waitFor(() => expect(calls.analyze).toBe(2));
    expect(screen.getByText("Actualizando…")).toBeInTheDocument();
    expect(screen.getByText("Ruta 1")).toBeInTheDocument();

    await act(async () => {
      resolveRefresh?.();
    });
    await waitFor(() => expect(screen.queryByText("Actualizando…")).not.toBeInTheDocument());
    expect(screen.getByText("21,4 km")).toBeInTheDocument();
    expect(calls.analyze).toBe(2);
  });

  it("never fires a second auto-refresh while a refresh mutation is pending", async () => {
    const user = userEvent.setup();
    let servedFirst = false;
    let resolveRefresh: (() => void) | undefined;
    const calls = mockFetch(() => {
      if (!servedFirst) {
        servedFirst = true;
        return analysisResponse();
      }
      return new Promise<Response>((resolve) => {
        resolveRefresh = () => resolve(analysisResponse(21.4));
      });
    });
    renderApp();

    await typeAndSearch();
    await screen.findByText("Recomendada");
    expect(calls.analyze).toBe(1);

    await user.click(screen.getByRole("button", { name: "Coche" }));
    await user.click(screen.getByRole("button", { name: "Buscar ruta" }));
    await waitFor(() => expect(calls.analyze).toBe(2));
    expect(screen.getByText("Actualizando…")).toBeInTheDocument();

    // change the activity again and resubmit while the refresh is pending
    await user.click(screen.getByRole("button", { name: "Moto" }));
    await user.click(screen.getByRole("button", { name: "Buscar ruta" }));

    // the debounce (~400ms) fires and the pending guard drops the request
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(calls.analyze).toBe(2);

    await act(async () => {
      resolveRefresh?.();
    });
    await waitFor(() => expect(screen.queryByText("Actualizando…")).not.toBeInTheDocument());
    expect(screen.getByText("21,4 km")).toBeInTheDocument();
  });

  it("treats an origin/destination text change as a new full search, not an auto-refresh", async () => {
    const user = userEvent.setup();
    let servedFirst = false;
    let resolveSecond: (() => void) | undefined;
    const calls = mockFetch(() => {
      if (!servedFirst) {
        servedFirst = true;
        return analysisResponse();
      }
      return new Promise<Response>((resolve) => {
        resolveSecond = () => resolve(analysisResponse());
      });
    });
    renderApp();

    await typeAndSearch();
    await screen.findByText("Recomendada");
    expect(calls.analyze).toBe(1);

    await user.type(screen.getByLabelText(/desde/i), " X");
    await user.click(screen.getByRole("button", { name: "Buscar ruta" }));

    // full search: loading replaces results and no incremental indicator shows
    await waitFor(() => expect(calls.analyze).toBe(2));
    expect(screen.queryByText("Actualizando…")).not.toBeInTheDocument();
    expect(screen.queryByText("Recomendada")).not.toBeInTheDocument();

    await act(async () => {
      resolveSecond?.();
    });
    await screen.findByText("Recomendada");
    expect(calls.analyze).toBe(2);
  });

  it("ignores a stale auto-refresh result that resolves after a new full search started", async () => {
    const user = userEvent.setup();
    let servedFirst = false;
    let resolveRefresh: (() => void) | undefined;
    let resolveFull: (() => void) | undefined;
    const calls = mockFetch(() => {
      if (!servedFirst) {
        servedFirst = true;
        return analysisResponse();
      }
      if (calls.analyze === 2) {
        return new Promise<Response>((resolve) => {
          resolveRefresh = () => resolve(analysisResponse(21.4));
        });
      }
      return new Promise<Response>((resolve) => {
        resolveFull = () => resolve(analysisResponse(9.3));
      });
    });
    renderApp();

    await typeAndSearch();
    await screen.findByText("Recomendada");
    expect(calls.analyze).toBe(1);

    await user.click(screen.getByRole("button", { name: "Coche" }));
    await user.click(screen.getByRole("button", { name: "Buscar ruta" }));
    await waitFor(() => expect(calls.analyze).toBe(2));
    expect(screen.getByText("Actualizando…")).toBeInTheDocument();

    // a new full search starts while the refresh is still pending
    await user.type(screen.getByLabelText(/desde/i), " X");
    await user.click(screen.getByRole("button", { name: "Buscar ruta" }));
    await waitFor(() => expect(calls.analyze).toBe(3));
    expect(screen.queryByText("Actualizando…")).not.toBeInTheDocument();

    // the stale refresh resolving first must not replace the loading full search
    await act(async () => {
      resolveRefresh?.();
    });
    expect(screen.queryByText("Recomendada")).not.toBeInTheDocument();

    await act(async () => {
      resolveFull?.();
    });
    await screen.findByText("Recomendada");
    expect(screen.getByText("9,3 km")).toBeInTheDocument();
  });

  it("preserves the user-selected route across an auto-refresh result", async () => {
    const user = userEvent.setup();
    let servedFirst = false;
    let resolveRefresh: (() => void) | undefined;
    const calls = mockFetch(() => {
      if (!servedFirst) {
        servedFirst = true;
        return analysisResponse();
      }
      return new Promise<Response>((resolve) => {
        resolveRefresh = () => resolve(analysisResponse(21.4));
      });
    });
    renderApp();

    await typeAndSearch();
    await screen.findByText("Recomendada");

    await user.click(screen.getByRole("button", { name: /Ruta 2/ }));
    const card = (index: number) =>
      document.querySelector(`[data-route-card][data-route-index="${index}"]`) as HTMLElement;
    expect(card(1)).toHaveAttribute("data-selected", "true");
    expect(card(0)).toHaveAttribute("data-selected", "false");

    await user.click(screen.getByRole("button", { name: "Coche" }));
    await user.click(screen.getByRole("button", { name: "Buscar ruta" }));
    await waitFor(() => expect(calls.analyze).toBe(2));
    expect(screen.getByText("Actualizando…")).toBeInTheDocument();

    await act(async () => {
      resolveRefresh?.();
    });
    await waitFor(() => expect(screen.queryByText("Actualizando…")).not.toBeInTheDocument());

    expect(card(1)).toHaveAttribute("data-selected", "true");
    expect(card(0)).toHaveAttribute("data-selected", "false");
  });

  it("skips a refresh when the resubmitted search is unchanged", async () => {
    const user = userEvent.setup();
    const calls = mockFetch(() => analysisResponse());
    renderApp();

    await typeAndSearch();
    await screen.findByText("Recomendada");
    expect(calls.analyze).toBe(1);

    await user.click(screen.getByRole("button", { name: "Buscar ruta" }));
    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(calls.analyze).toBe(1);
    expect(screen.queryByText("Actualizando…")).not.toBeInTheDocument();
  });
});