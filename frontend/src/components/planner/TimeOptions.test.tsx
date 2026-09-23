import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TimeOptions from "./TimeOptions";

afterEach(() => {
  vi.useRealTimers();
});

const PRESET_NAMES = ["Ahora", "Hoy 18:00", "Mañana 08:00", "Personalizar"];

describe("TimeOptions", () => {
  it("renders the three time presets plus the Personalizar option", () => {
    render(<TimeOptions departure="" onDepartureChange={vi.fn()} />);
    for (const name of PRESET_NAMES) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("group", { name: "Momento de salida" })).toBeInTheDocument();
  });

  it("starts with Ahora selected and emits preset departures", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 22, 9, 0, 0));
    const onDepartureChange = vi.fn();
    render(<TimeOptions departure="" onDepartureChange={onDepartureChange} />);

    expect(screen.getByRole("button", { name: "Ahora" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Mañana 08:00" }));
    expect(onDepartureChange).toHaveBeenLastCalledWith(
      new Date(2026, 8, 23, 8, 0, 0).toISOString(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Hoy 18:00" }));
    expect(onDepartureChange).toHaveBeenLastCalledWith(
      new Date(2026, 8, 22, 18, 0, 0).toISOString(),
    );
    expect(screen.getByRole("button", { name: "Hoy 18:00" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("reveals AdvancedOptions when Personalizar is selected", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 22, 9, 0, 0));
    render(<TimeOptions departure="" onDepartureChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Personalizar" }));

    expect(screen.getByRole("button", { name: "Personalizar" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Opciones avanzadas")).toBeInTheDocument();
    expect(screen.getByLabelText("Fecha")).toBeInTheDocument();
    expect(screen.getByLabelText("Hora de salida")).toBeInTheDocument();
    expect(screen.getByLabelText("Duración máx. (min)")).toBeInTheDocument();
  });

  it("hides the advanced options when a preset is selected again", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 22, 9, 0, 0));
    render(<TimeOptions departure="" onDepartureChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Personalizar" }));
    expect(screen.getByLabelText("Fecha")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ahora" }));
    expect(screen.queryByLabelText("Fecha")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ahora" })).toHaveAttribute("aria-pressed", "true");
  });

  it("forwards the current departure to AdvancedOptions in custom mode", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 22, 9, 0, 0));
    const departure = new Date(2026, 8, 24, 12, 0, 0).toISOString();
    render(<TimeOptions departure={departure} onDepartureChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Personalizar" }));

    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-24");
    expect(screen.getByLabelText("Hora de salida")).toHaveValue("12:00");
  });
});
