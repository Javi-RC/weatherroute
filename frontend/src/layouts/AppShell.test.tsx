import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AppShell from "./AppShell";

function renderShell(props: Partial<React.ComponentProps<typeof AppShell>> = {}) {
  return render(
    <AppShell
      headerSlot={<div data-testid="header-slot" />}
      sidebarSlot={<div data-testid="sidebar-slot">sidebar</div>}
      isCompact={false}
      {...props}
    >
      <div data-testid="map" />
    </AppShell>,
  );
}

describe("AppShell", () => {
  it("lays out the sidebar beside the map rather than over it", () => {
    const { container } = renderShell();

    const root = container.firstElementChild!;
    expect(root.className).toContain("flex");
    expect(root.className).not.toContain("absolute");
  });

  it("keeps the map in a non-shrinking flex child", () => {
    renderShell();

    expect(screen.getByTestId("map").parentElement?.className).toContain("min-w-0");
  });

  it("still offers a skip link to the map region", () => {
    renderShell();

    const skipLink = screen.getAllByRole("link")[0];
    expect(skipLink).toHaveTextContent("Saltar al mapa");
    expect(skipLink).toHaveAttribute("href", "#contenido");
    expect(skipLink).toHaveClass("sr-only");
    expect(skipLink).toHaveClass("focus:not-sr-only");
  });

  it("exposes a main region with id contenido", () => {
    renderShell();

    expect(screen.getByRole("main")).toHaveAttribute("id", "contenido");
  });

  it("renders the header slot above the flex row", () => {
    const { container } = renderShell();

    const root = container.firstElementChild!;
    expect(root.children[1]).toContainElement(screen.getByTestId("header-slot"));
  });

  it("renders the sidebar as a 380px column with a 400px xl variant", () => {
    renderShell();

    const sidebar = screen.getByRole("complementary", { name: "Planificador de rutas" });
    expect(sidebar).toHaveClass("w-[380px]", "xl:w-[400px]", "shrink-0");
  });

  it("renders the sidebar content in the column", () => {
    renderShell();

    const sidebar = screen.getByRole("complementary", { name: "Planificador de rutas" });
    expect(within(sidebar).getByTestId("sidebar-slot")).toBeInTheDocument();
  });

  it("replaces the sidebar column with a sheet trigger on mobile", () => {
    renderShell({ isCompact: true });

    expect(screen.getByRole("button", { name: /planificador/i })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Planificador de rutas" })).not.toBeInTheDocument();
  });

  it("opens the sidebar content in a dialog on mobile", async () => {
    renderShell({ isCompact: true });

    expect(screen.queryByTestId("sidebar-slot")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /planificador/i }));

    const dialog = screen.getByRole("dialog", { name: /planificador/i });
    expect(within(dialog).getByTestId("sidebar-slot")).toBeInTheDocument();
  });

  it("keeps the map behind the sheet on mobile", () => {
    renderShell({ isCompact: true });

    expect(screen.getByTestId("map")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveClass("flex-1", "min-w-0");
  });

  it("omits the map overlays when no slots are provided", () => {
    renderShell({ welcomeSlot: undefined, legendSlot: undefined });

    expect(screen.queryByTestId("app-shell-welcome")).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-shell-legend")).not.toBeInTheDocument();
  });

  it("renders the welcome and legend overlays above the map", () => {
    renderShell({ welcomeSlot: <div>Bienvenida</div>, legendSlot: <div>Leyenda</div> });

    expect(screen.getByTestId("app-shell-welcome")).toHaveTextContent("Bienvenida");
    expect(screen.getByTestId("app-shell-legend")).toHaveTextContent("Leyenda");
  });

  it("moves the legend to the right edge on mobile", () => {
    renderShell({ legendSlot: <div>Leyenda</div>, isCompact: true });

    expect(screen.getByTestId("app-shell-legend")).toHaveClass("right-4");
  });

  it("does not render the planner sheet twice on mobile", () => {
    renderShell({ isCompact: true });

    expect(screen.getAllByRole("button", { name: /planificador/i })).toHaveLength(1);
  });

  it("does not warn about the removed callbacks", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderShell();

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
