import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../services/api";
import type { PlaceCandidate } from "../../types";
import OriginDestinationFields, {
  type OriginDestinationFieldsHandle,
} from "./OriginDestinationFields";

function Controlled(props: { onOriginResolved?: (c: PlaceCandidate) => void; onLocationError?: () => void } = {}) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  return (
    <OriginDestinationFields
      origin={origin}
      destination={destination}
      onOriginChange={setOrigin}
      onDestinationChange={setDestination}
      onOriginResolved={props.onOriginResolved}
      onLocationError={props.onLocationError}
    />
  );
}

function RevalidateHarness() {
  const ref = useRef<OriginDestinationFieldsHandle>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [outcome, setOutcome] = useState("not-run");
  return (
    <>
      <OriginDestinationFields
        ref={ref}
        origin={origin}
        destination={destination}
        onOriginChange={setOrigin}
        onDestinationChange={setDestination}
      />
      <button type="button" onClick={() => setOutcome(ref.current?.validate() ? "invalid" : "valid")}>
        Validar
      </button>
      <output aria-label="resultado">{outcome}</output>
    </>
  );
}

function stubGeolocation(
  impl: (
    success: (position: GeolocationPosition) => void,
    error: (error: GeolocationPositionError) => void,
  ) => void,
) {
  Object.defineProperty(globalThis.navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: vi.fn(impl) },
  });
}

function position(lat: number, lon: number): GeolocationPosition {
  return { coords: { latitude: lat, longitude: lon } } as GeolocationPosition;
}

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error test cleanup of a test-only stub
  delete globalThis.navigator.geolocation;
});

describe("OriginDestinationFields", () => {
  it("renders Desde/Hasta autocomplete inputs and an enabled Usar mi ubicación button", () => {
    render(<Controlled />);
    expect(screen.getByLabelText(/Desde/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hasta/)).toBeInTheDocument();

    const geolocate = screen.getByRole("button", { name: "Usar mi ubicación" });
    expect(geolocate).toBeEnabled();
  });

  it("shows a Spanish inline error with aria wiring on blur", async () => {
    const user = userEvent.setup();
    render(<Controlled />);

    await user.click(screen.getByLabelText(/Desde/));
    await user.click(screen.getByLabelText(/Hasta/));

    const origin = screen.getByLabelText(/Desde/);
    expect(origin).toHaveAttribute("aria-invalid", "true");
    const describedBy = origin.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy)).toHaveTextContent("Origen requerido");
    expect(screen.getByRole("alert")).toHaveTextContent("Origen requerido");
  });

  it("clears a field error when the user starts typing", async () => {
    const user = userEvent.setup();
    render(<Controlled />);

    await user.click(screen.getByLabelText(/Desde/));
    await user.click(screen.getByLabelText(/Hasta/));
    expect(screen.getByText("Origen requerido")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Desde/), "Ciudad Real");
    expect(screen.queryByText("Origen requerido")).not.toBeInTheDocument();
  });

  it("revalidates all fields on submit via the imperative handle", async () => {
    const user = userEvent.setup();
    render(<RevalidateHarness />);

    await user.type(screen.getByLabelText(/Desde/), "Ciudad Real");
    await user.click(screen.getByRole("button", { name: "Validar" }));

    expect(screen.getByLabelText("resultado")).toHaveTextContent("invalid");
    expect(screen.getByLabelText(/Hasta/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Destino requerido");

    await user.type(screen.getByLabelText(/Hasta/), "Almagro");
    await user.click(screen.getByRole("button", { name: "Validar" }));

    expect(screen.getByLabelText("resultado")).toHaveTextContent("valid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("selecting an autocomplete suggestion fills the field and resolves it", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "searchPlaces").mockResolvedValue([
      { label: "Ciudad Real, España", lat: 38.9861, lon: -3.9292 },
    ]);
    const onOriginResolved = vi.fn();
    render(<Controlled onOriginResolved={onOriginResolved} />);

    await user.type(screen.getByLabelText(/Desde/), "Ciudad");
    const option = await screen.findByRole("option", { name: "Ciudad Real, España" });
    await user.click(option);

    expect(onOriginResolved).toHaveBeenCalledWith({
      label: "Ciudad Real, España",
      lat: 38.9861,
      lon: -3.9292,
    });
    expect(screen.getByLabelText(/Desde/)).toHaveValue("Ciudad Real, España");
  });

  it("fills the origin field from the browser's location on success", async () => {
    const user = userEvent.setup();
    stubGeolocation((success) => success(position(38.9861, -3.9292)));
    vi.spyOn(api, "reverseGeocode").mockResolvedValue("Ciudad Real, España");
    const onOriginResolved = vi.fn();
    render(<Controlled onOriginResolved={onOriginResolved} />);

    await user.click(screen.getByRole("button", { name: "Usar mi ubicación" }));

    await waitFor(() => expect(screen.getByLabelText(/Desde/)).toHaveValue("Ciudad Real, España"));
    expect(onOriginResolved).toHaveBeenCalledWith({
      label: "Ciudad Real, España",
      lat: 38.9861,
      lon: -3.9292,
    });
  });

  it("shows aria-busy on the location button while resolving", async () => {
    const user = userEvent.setup();
    let resolvePosition: (() => void) | undefined;
    stubGeolocation((success) => {
      resolvePosition = () => success(position(38.9861, -3.9292));
    });
    vi.spyOn(api, "reverseGeocode").mockResolvedValue("Ciudad Real, España");
    render(<Controlled />);

    const button = screen.getByRole("button", { name: "Usar mi ubicación" });
    await user.click(button);

    expect(button).toHaveAttribute("aria-busy", "true");
    resolvePosition?.();
    await waitFor(() => expect(button).not.toHaveAttribute("aria-busy"));
  });

  it("falls back to a generic label when reverse geocoding finds nothing", async () => {
    const user = userEvent.setup();
    stubGeolocation((success) => success(position(38.9861, -3.9292)));
    vi.spyOn(api, "reverseGeocode").mockResolvedValue(null);
    render(<Controlled />);

    await user.click(screen.getByRole("button", { name: "Usar mi ubicación" }));

    await waitFor(() => expect(screen.getByLabelText(/Desde/)).toHaveValue("Mi ubicación"));
  });

  it("calls onLocationError when geolocation permission is denied", async () => {
    const user = userEvent.setup();
    stubGeolocation((_success, error) =>
      error({ code: 1, message: "denied" } as GeolocationPositionError),
    );
    const onLocationError = vi.fn();
    render(<Controlled onLocationError={onLocationError} />);

    await user.click(screen.getByRole("button", { name: "Usar mi ubicación" }));

    await waitFor(() => expect(onLocationError).toHaveBeenCalledTimes(1));
  });
});
