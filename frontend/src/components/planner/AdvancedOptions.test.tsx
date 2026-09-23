import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { maxDate, minDate } from "../../lib/time";
import AdvancedOptions from "./AdvancedOptions";

afterEach(() => {
  vi.useRealTimers();
});

function dateStr(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

describe("AdvancedOptions", () => {
  it("defaults date and time from defaultDeparture", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 22, 6, 30, 0));
    const onDepartureChange = vi.fn();
    render(<AdvancedOptions onDepartureChange={onDepartureChange} />);

    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-22");
    expect(screen.getByLabelText("Hora de salida")).toHaveValue("08:00");
    expect(onDepartureChange).toHaveBeenCalledWith(new Date(2026, 8, 22, 8, 0, 0).toISOString());
  });

  it("defaults to now once today 08:00 has passed", () => {
    vi.useFakeTimers();
    const now = new Date(2026, 8, 22, 10, 0, 0);
    vi.setSystemTime(now);
    const onDepartureChange = vi.fn();
    render(<AdvancedOptions onDepartureChange={onDepartureChange} />);

    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-22");
    expect(screen.getByLabelText("Hora de salida")).toHaveValue("10:00");
    expect(onDepartureChange).toHaveBeenCalledWith(now.toISOString());
  });

  it("clamps the date window to [today, today+7] via min/max attributes", () => {
    vi.useFakeTimers();
    const now = new Date(2026, 8, 22, 15, 0, 0);
    vi.setSystemTime(now);
    render(<AdvancedOptions onDepartureChange={vi.fn()} />);

    const dateInput = screen.getByLabelText("Fecha");
    expect(dateInput).toHaveAttribute("min", dateStr(minDate()));
    expect(dateInput).toHaveAttribute("max", dateStr(maxDate()));
  });

  it("clamps a date beyond the +7 days window to maxDate", () => {
    vi.useFakeTimers();
    const now = new Date(2026, 8, 22, 15, 0, 0);
    vi.setSystemTime(now);
    const onDepartureChange = vi.fn();
    render(<AdvancedOptions onDepartureChange={onDepartureChange} />);

    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-10-05" } });

    expect(onDepartureChange).toHaveBeenLastCalledWith(maxDate(now).toISOString());
    expect(screen.getByLabelText("Fecha")).toHaveValue(dateStr(maxDate(now)));
    expect(screen.getByLabelText("Hora de salida")).toHaveValue("00:00");
  });

  it("clamps a date before today to minDate", () => {
    vi.useFakeTimers();
    const now = new Date(2026, 8, 22, 15, 0, 0);
    vi.setSystemTime(now);
    const onDepartureChange = vi.fn();
    render(<AdvancedOptions onDepartureChange={onDepartureChange} />);

    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-15" } });

    expect(onDepartureChange).toHaveBeenLastCalledWith(minDate(now).toISOString());
    expect(screen.getByLabelText("Fecha")).toHaveValue(dateStr(minDate(now)));
    expect(screen.getByLabelText("Hora de salida")).toHaveValue("00:00");
  });

  it("shows a Spanish error for out-of-range durations and emits only valid values", async () => {
    const user = userEvent.setup();
    const onDurationMaxChange = vi.fn();
    render(
      <AdvancedOptions
        onDepartureChange={vi.fn()}
        durationMax={null}
        onDurationMaxChange={onDurationMaxChange}
      />,
    );

    const durationInput = screen.getByLabelText("Duración máx. (min)");
    await user.type(durationInput, "0");
    expect(screen.getByText("Entre 1 y 1440 minutos")).toBeInTheDocument();
    expect(onDurationMaxChange).not.toHaveBeenCalledWith(0);
    expect(onDurationMaxChange).toHaveBeenLastCalledWith(null);

    await user.clear(durationInput);
    expect(onDurationMaxChange).toHaveBeenLastCalledWith(null);

    await user.type(durationInput, "120");
    expect(onDurationMaxChange).toHaveBeenLastCalledWith(120);
    expect(screen.queryByText("Entre 1 y 1440 minutos")).not.toBeInTheDocument();
  });

  it("rejects values above 1440 and clears the parent-visible value", async () => {
    const user = userEvent.setup();
    const onDurationMaxChange = vi.fn();
    render(
      <AdvancedOptions
        onDepartureChange={vi.fn()}
        durationMax={null}
        onDurationMaxChange={onDurationMaxChange}
      />,
    );

    await user.type(screen.getByLabelText("Duración máx. (min)"), "2000");
    expect(screen.getByText("Entre 1 y 1440 minutos")).toBeInTheDocument();
    expect(onDurationMaxChange).not.toHaveBeenCalledWith(2000);
    expect(onDurationMaxChange).toHaveBeenLastCalledWith(null);
  });

  it("clearing the duration emits null", async () => {
    const user = userEvent.setup();
    const onDurationMaxChange = vi.fn();
    render(
      <AdvancedOptions
        onDepartureChange={vi.fn()}
        durationMax={120}
        onDurationMaxChange={onDurationMaxChange}
      />,
    );

    expect(screen.getByLabelText("Duración máx. (min)")).toHaveValue(120);
    await user.clear(screen.getByLabelText("Duración máx. (min)"));
    expect(onDurationMaxChange).toHaveBeenLastCalledWith(null);
  });

  it("initializes from a provided UTC ISO departure", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 22, 15, 0, 0));
    const departure = new Date(2026, 8, 25, 18, 0, 0).toISOString();
    const onDepartureChange = vi.fn();
    render(<AdvancedOptions value={departure} onDepartureChange={onDepartureChange} />);

    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-25");
    expect(screen.getByLabelText("Hora de salida")).toHaveValue("18:00");
  });
});
