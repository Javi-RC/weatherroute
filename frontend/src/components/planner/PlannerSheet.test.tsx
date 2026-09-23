import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlannerSearch } from "./PlannerForm";
import PlannerSheet from "./PlannerSheet";

afterEach(() => vi.restoreAllMocks());

function geoFetch() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    new Response(JSON.stringify({ coordinates: { lat: 38.9861, lon: -3.9292 } }), {
      status: 200,
    }),
  );
}

describe("PlannerSheet", () => {
  it("renders the planner as a desktop panel with the form visible", () => {
    render(<PlannerSheet busy={false} onSearch={vi.fn()} isCompact={false} />);

    expect(screen.getByTestId("planner-sheet")).toBeInTheDocument();
    expect(screen.getByLabelText(/Desde/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buscar ruta" })).toBeInTheDocument();
    expect(screen.queryByTestId("planner-fab")).not.toBeInTheDocument();
  });

  it("shows a floating pill on mobile and expands it into a bottom sheet", async () => {
    const user = userEvent.setup();
    render(<PlannerSheet busy={false} onSearch={vi.fn()} isCompact />);

    expect(screen.getByTestId("planner-fab")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Planificar ruta" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Desde/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Planificar ruta" }));

    expect(screen.getByRole("dialog", { name: "Planificador" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Desde/i)).toBeInTheDocument();
  });

  it("collapses the sheet after a successful search and forwards the payload", async () => {
    geoFetch();
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<PlannerSheet busy={false} onSearch={onSearch} isCompact />);

    await user.click(screen.getByRole("button", { name: "Planificar ruta" }));
    await user.type(screen.getByLabelText(/Desde/i), "Ciudad Real");
    await user.type(screen.getByLabelText(/Hasta/i), "Almagro");
    await user.click(screen.getByRole("button", { name: "Buscar ruta" }));
    await act(async () => {});

    expect(onSearch).toHaveBeenCalledTimes(1);
    const payload = onSearch.mock.calls[0][0] as PlannerSearch;
    expect(payload.origin).toBe("Ciudad Real");
    expect(payload.destination).toBe("Almagro");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("planner-fab")).toBeInTheDocument();
  });

  it("keeps the floating pill but disabled while the search is busy", () => {
    render(<PlannerSheet busy onSearch={vi.fn()} isCompact />);

    const pill = screen.getByRole("button", { name: "Calculando…" });
    expect(pill).toBeDisabled();
  });
});