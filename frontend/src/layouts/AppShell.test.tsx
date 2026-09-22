import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AppShell from "./AppShell";

describe("AppShell", () => {
  it("renders the header with the brand", () => {
    render(<AppShell />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "WeatherRoute" }),
    ).toBeInTheDocument();
  });

  it("exposes a main region with id contenido", () => {
    render(<AppShell />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "contenido");
  });

  it("positions the map slot absolutely inset-0 and renders its children", () => {
    render(
      <AppShell>
        <p>Mapa</p>
      </AppShell>,
    );

    const mapSlot = screen.getByTestId("app-shell-map");
    expect(mapSlot).toHaveClass("absolute", "inset-0");
    expect(mapSlot).toHaveTextContent("Mapa");
  });

  it("renders both floating slot regions when provided", () => {
    render(
      <AppShell
        plannerSlot={<p>Planificador</p>}
        resultsSlot={<p>Resultados</p>}
      />,
    );

    expect(screen.getByTestId("app-shell-planner")).toHaveTextContent(
      "Planificador",
    );
    expect(screen.getByTestId("app-shell-results")).toHaveTextContent(
      "Resultados",
    );
  });

  it("omits floating slots when not provided", () => {
    render(<AppShell />);

    expect(screen.queryByTestId("app-shell-planner")).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-shell-results")).not.toBeInTheDocument();
  });

  it("forwards header callbacks", async () => {
    const onOpenAbout = vi.fn();
    const onOpenHistory = vi.fn();
    render(<AppShell onOpenAbout={onOpenAbout} onOpenHistory={onOpenHistory} />);

    await userEvent.click(screen.getByRole("button", { name: "Cómo funciona" }));
    await userEvent.click(screen.getByRole("button", { name: "Historial" }));

    expect(onOpenAbout).toHaveBeenCalledTimes(1);
    expect(onOpenHistory).toHaveBeenCalledTimes(1);
  });
});