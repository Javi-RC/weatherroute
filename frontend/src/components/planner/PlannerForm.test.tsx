import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePlace } from "../../lib/places";
import type { ResolvedPlace } from "../../lib/places";
import PlannerForm from "./PlannerForm";

vi.mock("../../lib/places", () => ({
  resolvePlace: vi.fn(),
}));

const mockedResolvePlace = vi.mocked(resolvePlace);

const PLACE_ERROR = "No encontramos ese lugar. Prueba otra ciudad o un nombre más concreto.";

const ORIGIN_PLACE: ResolvedPlace = { label: "Ciudad Real", lat: 38.9861, lon: -3.9292 };
const DESTINATION_PLACE: ResolvedPlace = { label: "Almagro", lat: 38.905, lon: -4.106 };

function fillPlaces() {
  fireEvent.change(screen.getByLabelText(/Desde/), { target: { value: "Ciudad Real" } });
  fireEvent.change(screen.getByLabelText(/Hasta/), { target: { value: "Almagro" } });
}

async function submitAndFlush() {
  fireEvent.click(screen.getByRole("button", { name: "Buscar ruta" }));
  await act(async () => {});
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 22, 9, 0, 0));
  mockedResolvePlace.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PlannerForm", () => {
  it("resolves both places in parallel and emits the full search payload", async () => {
    mockedResolvePlace
      .mockResolvedValueOnce(ORIGIN_PLACE)
      .mockResolvedValueOnce(DESTINATION_PLACE);
    const onSearch = vi.fn();
    render(<PlannerForm onSearch={onSearch} />);

    fillPlaces();
    fireEvent.click(screen.getByRole("button", { name: "Correr" }));
    await submitAndFlush();

    expect(mockedResolvePlace).toHaveBeenCalledTimes(2);
    expect(mockedResolvePlace).toHaveBeenNthCalledWith(1, "Ciudad Real");
    expect(mockedResolvePlace).toHaveBeenNthCalledWith(2, "Almagro");
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith({
      origin: "Ciudad Real",
      destination: "Almagro",
      originPoint: { latitude: 38.9861, longitude: -3.9292 },
      destinationPoint: { latitude: 38.905, longitude: -4.106 },
      activity: "Running",
      departureTime: new Date(2026, 8, 22, 9, 0, 0).toISOString(),
      maxDurationMinutes: null,
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buscar ruta" })).toBeEnabled();
  });

  it.each<[string, number]>([
    ["origin", 0],
    ["destination", 1],
  ])(
    "shows the unresolved-place error only on the %s field and does not emit",
    async (field, rejectIndex) => {
      let callIndex = 0;
      mockedResolvePlace.mockImplementation(async (input) => {
        const index = callIndex;
        callIndex += 1;
        if (index === rejectIndex) throw new Error("geocode failed");
        return { label: input.trim(), lat: 1, lon: 2 };
      });
      const onSearch = vi.fn();
      render(<PlannerForm onSearch={onSearch} />);

      fillPlaces();
      await submitAndFlush();

      expect(onSearch).not.toHaveBeenCalled();
      expect(screen.getAllByText(PLACE_ERROR)).toHaveLength(1);
      expect(screen.getByTestId(`${field}-error`)).toHaveTextContent(PLACE_ERROR);
      const other = field === "origin" ? "destination" : "origin";
      expect(screen.queryByTestId(`${other}-error`)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Desde/)).toHaveValue("Ciudad Real");
      expect(screen.getByLabelText(/Hasta/)).toHaveValue("Almagro");
      expect(screen.getByRole("button", { name: "Buscar ruta" })).toBeEnabled();
    },
  );

  it("updates the departure when the time chips change", async () => {
    mockedResolvePlace.mockImplementation(async (input) => ({
      label: input.trim(),
      lat: 1,
      lon: 2,
    }));
    const onSearch = vi.fn();
    render(<PlannerForm onSearch={onSearch} />);

    expect(screen.getByRole("button", { name: "Ahora" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Hoy 18:00" }));
    expect(screen.getByRole("button", { name: "Hoy 18:00" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fillPlaces();
    fireEvent.click(screen.getByRole("button", { name: "Mañana 08:00" }));
    await submitAndFlush();

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ departureTime: new Date(2026, 8, 23, 8, 0, 0).toISOString() }),
    );
  });

  it("reveals the advanced inputs, clamps the date to +7 days and sends the duration", async () => {
    mockedResolvePlace.mockImplementation(async (input) => ({
      label: input.trim(),
      lat: 1,
      lon: 2,
    }));
    const onSearch = vi.fn();
    render(<PlannerForm onSearch={onSearch} />);

    fireEvent.click(screen.getByRole("button", { name: "Personalizar" }));
    expect(screen.getByLabelText("Fecha")).toBeInTheDocument();
    expect(screen.getByLabelText("Hora de salida")).toBeInTheDocument();

    fillPlaces();
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-10-05" } });
    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-29");
    expect(screen.getByLabelText("Hora de salida")).toHaveValue("00:00");

    fireEvent.change(screen.getByLabelText("Duración máx. (min)"), { target: { value: "120" } });
    await submitAndFlush();

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        departureTime: new Date(2026, 8, 29, 0, 0, 0).toISOString(),
        maxDurationMinutes: 120,
      }),
    );
  });

  it("disables the submit button with a spinner while a search is pending", async () => {
    let releaseOrigin!: (place: ResolvedPlace) => void;
    let releaseDestination!: (place: ResolvedPlace) => void;
    const originGate = new Promise<ResolvedPlace>((resolve) => {
      releaseOrigin = resolve;
    });
    const destinationGate = new Promise<ResolvedPlace>((resolve) => {
      releaseDestination = resolve;
    });
    mockedResolvePlace.mockReturnValueOnce(originGate).mockReturnValueOnce(destinationGate);
    const onSearch = vi.fn();
    render(<PlannerForm onSearch={onSearch} />);

    fillPlaces();
    fireEvent.click(screen.getByRole("button", { name: "Buscar ruta" }));

    const submit = screen.getByRole("button", { name: "Buscar ruta" });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute("aria-busy", "true");
    expect(submit.querySelector("svg.animate-spin")).toBeInTheDocument();
    expect(onSearch).not.toHaveBeenCalled();

    await act(async () => {
      releaseOrigin(ORIGIN_PLACE);
      releaseDestination(DESTINATION_PLACE);
    });

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Buscar ruta" })).toBeEnabled();
  });

  it("validates required fields with the shared Spanish messages before resolving", async () => {
    const onSearch = vi.fn();
    render(<PlannerForm onSearch={onSearch} />);

    await submitAndFlush();

    expect(screen.getByText("Origen requerido")).toBeInTheDocument();
    expect(screen.getByText("Destino requerido")).toBeInTheDocument();
    expect(mockedResolvePlace).not.toHaveBeenCalled();
    expect(onSearch).not.toHaveBeenCalled();
  });
});
