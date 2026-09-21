import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import RouteForm from "./RouteForm";

describe("RouteForm", () => {
  it("submits the specified route values", async () => {
    const onSubmit = vi.fn();
    render(<RouteForm onSubmit={onSubmit} loading={false} />);

    await userEvent.clear(screen.getByLabelText(/desde/i));
    await userEvent.type(screen.getByLabelText(/desde/i), "Ciudad Real");
    await userEvent.clear(screen.getByLabelText(/hasta/i));
    await userEvent.type(screen.getByLabelText(/hasta/i), "Almagro");
    await userEvent.click(screen.getByRole("button", { name: /analizar ruta/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ origin: "Ciudad Real", destination: "Almagro", activity: "Cycling" }),
      expect.anything(),
    );
  });

  it("submits the max duration when provided", async () => {
    const onSubmit = vi.fn();
    render(<RouteForm onSubmit={onSubmit} loading={false} />);

    await userEvent.clear(screen.getByLabelText(/desde/i));
    await userEvent.type(screen.getByLabelText(/desde/i), "Ciudad Real");
    await userEvent.clear(screen.getByLabelText(/hasta/i));
    await userEvent.type(screen.getByLabelText(/hasta/i), "Almagro");
    await userEvent.type(screen.getByLabelText(/duración/i), "120");
    await userEvent.click(screen.getByRole("button", { name: /analizar ruta/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ maxDurationMinutes: 120 }),
      expect.anything(),
    );
  });
});