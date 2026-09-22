import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Button from "./Button";

describe("Button", () => {
  it("renders its label and fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Analizar ruta</Button>);

    const button = screen.getByRole("button", { name: "Analizar ruta" });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("defaults to type=button", () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole("button", { name: "Guardar" })).toHaveAttribute("type", "button");
  });

  it("applies variant and size classes", () => {
    render(
      <>
        <Button variant="secondary" size="sm">
          Secundario
        </Button>
        <Button variant="ghost" size="lg">
          Fantasma
        </Button>
        <Button variant="danger">Peligro</Button>
      </>,
    );

    const secondary = screen.getByRole("button", { name: "Secundario" });
    expect(secondary).toHaveClass("bg-white", "border-sand-300", "px-3", "text-sm");
    const ghost = screen.getByRole("button", { name: "Fantasma" });
    expect(ghost).toHaveClass("text-ocean-700", "px-5", "text-base");
    const danger = screen.getByRole("button", { name: "Peligro" });
    expect(danger).toHaveClass("bg-danger");
  });

  it("exposes focus-visible, hover and pressed (active) state classes", () => {
    render(<Button>Enfoque</Button>);
    const button = screen.getByRole("button", { name: "Enfoque" });

    expect(button.className).toContain("focus-visible:ring-2");
    expect(button.className).toContain("focus-visible:ring-ocean-600");
    expect(button.className).toContain("focus-visible:ring-offset-2");
    expect(button.className).toContain("hover:");
    expect(button.className).toContain("active:");
  });

  it("disables itself when the disabled prop is set", () => {
    render(<Button disabled>Deshabilitado</Button>);
    expect(screen.getByRole("button", { name: "Deshabilitado" })).toBeDisabled();
  });

  it("shows a spinner with aria-busy and keeps the action name while loading", () => {
    render(<Button loading>Analizar ruta</Button>);

    const button = screen.getByRole("button", { name: "Analizar ruta" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Cargando…");
    expect(button.querySelector("svg")).toBeInTheDocument();
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden");
  });

  it("accepts a custom loading label", () => {
    render(
      <Button loading loadingLabel="Buscando…">
        Analizar ruta
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Analizar ruta" })).toHaveTextContent(
      "Buscando…",
    );
  });

  it("does not set aria-busy when resting", () => {
    render(<Button>Reposo</Button>);
    const button = screen.getByRole("button", { name: "Reposo" });
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button).toBeEnabled();
  });
});