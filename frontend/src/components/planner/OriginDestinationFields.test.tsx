import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import OriginDestinationFields, {
  type OriginDestinationFieldsHandle,
} from "./OriginDestinationFields";

function Controlled() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  return (
    <OriginDestinationFields
      origin={origin}
      destination={destination}
      onOriginChange={setOrigin}
      onDestinationChange={setDestination}
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

describe("OriginDestinationFields", () => {
  it("renders Desde/Hasta inputs and a disabled Usar mi ubicación button", () => {
    render(<Controlled />);
    expect(screen.getByLabelText(/Desde/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hasta/)).toBeInTheDocument();

    const geolocate = screen.getByRole("button", { name: "Usar mi ubicación" });
    expect(geolocate).toBeDisabled();
  });

  it("reserves the autocomplete arrow-down affordance on both fields", () => {
    const { getByTestId } = render(<Controlled />);
    expect(getByTestId("origin-autocomplete-hint")).toBeInTheDocument();
    expect(getByTestId("destination-autocomplete-hint")).toBeInTheDocument();
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
});
