import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Field from "./Field";
import TextInput from "./TextInput";

describe("Field", () => {
  it("associates the label with the child input", () => {
    render(
      <Field label="Origen">
        <TextInput />
      </Field>,
    );
    const input = screen.getByLabelText("Origen");
    expect(input.tagName).toBe("INPUT");
  });

  it("wires help text through aria-describedby when there is no error", () => {
    render(
      <Field label="Origen" help="Nombre de la ciudad de salida">
        <TextInput />
      </Field>,
    );
    const input = screen.getByLabelText("Origen");
    expect(input).not.toHaveAttribute("aria-invalid", "true");

    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? "")).toHaveTextContent(
      "Nombre de la ciudad de salida",
    );
  });

  it("marks the input invalid and describes it with the inline error", () => {
    render(
      <Field label="Origen" error="Origen requerido">
        <TextInput />
      </Field>,
    );
    const input = screen.getByLabelText("Origen");
    expect(input).toHaveAttribute("aria-invalid", "true");

    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? "")).toHaveTextContent("Origen requerido");
    expect(screen.getByRole("alert")).toHaveTextContent("Origen requerido");
  });

  it("prefers the error over help text", () => {
    render(
      <Field label="Destino" help="Ayuda" error="Destino requerido">
        <TextInput />
      </Field>,
    );
    const input = screen.getByLabelText("Destino");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy)).toHaveTextContent("Destino requerido");
    expect(document.getElementById(describedBy)).not.toHaveTextContent("Ayuda");
    expect(screen.queryByText("Ayuda")).not.toBeInTheDocument();
  });

  it("renders a required indicator", () => {
    render(
      <Field label="Origen" required>
        <TextInput />
      </Field>,
    );
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("applies the given id when the child already carries props (preserved via clone)", () => {
    render(
      <Field label="Hora">
        <input data-testid="raw-input" readOnly />
      </Field>,
    );
    const input = screen.getByLabelText("Hora") as HTMLInputElement;
    expect(input).toHaveAttribute("data-testid", "raw-input");
  });
});