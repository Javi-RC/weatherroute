import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Sheet from "./Sheet";

describe("Sheet", () => {
  it("renders a modal dialog labelled by its title when open", () => {
    render(
      <Sheet open title="Planner" onClose={vi.fn()}>
        Contenido
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Planner" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(document.getElementById(labelledBy!)).toHaveTextContent("Planner");
  });

  it("is not in the DOM when closed", () => {
    render(
      <Sheet open={false} onClose={vi.fn()}>
        Contenido
      </Sheet>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("moves focus into the sheet on open", () => {
    render(
      <Sheet open onClose={vi.fn()}>
        Contenido
      </Sheet>,
    );
    expect(document.activeElement).toBe(screen.getByRole("dialog"));
  });

  it("renders its children and a close action with an accessible name", () => {
    render(
      <Sheet open onClose={vi.fn()}>
        <p>Detalle de ruta</p>
      </Sheet>,
    );
    expect(screen.getByText("Detalle de ruta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose}>
        Contenido
      </Sheet>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the backdrop is clicked", async () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose}>
        Contenido
      </Sheet>,
    );
    await userEvent.click(screen.getByTestId("sheet-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps a bottom sheet anchored to the bottom with a reduced-motion transition", () => {
    render(
      <Sheet open onClose={vi.fn()}>
        Contenido
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("inset-x-0");
    expect(dialog.className).toContain("bottom-0");
    expect(dialog.className).toContain("motion-safe:transition-transform");
    expect(dialog.className).toContain("motion-safe:duration-300");
  });

  it("anchors a side sheet to the right with a horizontal motion-safe transition", () => {
    render(
      <Sheet open position="side" onClose={vi.fn()}>
        Contenido
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("right-0");
    expect(dialog.className).toContain("translate-x-");
    expect(dialog.className).toContain("motion-safe:");
  });

  it("cycles focus within the sheet on Tab and Shift+Tab", async () => {
    const user = userEvent.setup();
    render(
      <Sheet open onClose={vi.fn()}>
        <button type="button">Acción interna</button>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog");
    const close = screen.getByRole("button", { name: "Cerrar" });
    const action = screen.getByRole("button", { name: "Acción interna" });
    dialog.focus();

    await user.tab();
    expect(document.activeElement).toBe(close);

    await user.tab();
    expect(document.activeElement).toBe(action);

    await user.tab();
    expect(document.activeElement).toBe(close);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(action);
  });
});