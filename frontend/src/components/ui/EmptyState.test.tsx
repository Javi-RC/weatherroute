import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FaCar } from "react-icons/fa";
import Button from "./Button";
import EmptyState from "./EmptyState";

describe("EmptyState", () => {
  it("renders an h2 title, description and a decorative aria-hidden icon", () => {
    const { container } = render(
      <EmptyState title="Diseña tu ruta" description="Elige origen y destino para empezar." />,
    );
    expect(screen.getByRole("heading", { name: "Diseña tu ruta", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Elige origen y destino para empezar.")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden");
  });

  it("renders the optional CTA action", () => {
    const onCta = vi.fn();
    render(
      <EmptyState
        title="Diseña tu ruta"
        description="Descripción"
        action={
          <Button onClick={onCta}>Planear ruta</Button>
        }
      />,
    );
    expect(screen.getByRole("button", { name: "Planear ruta" })).toBeInTheDocument();
  });

  it("honors a custom icon", () => {
    const { container } = render(
      <EmptyState icon={FaCar} title="En coche" description="Descripción" />,
    );
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden");
  });

  it("merges extra classes", () => {
    render(<EmptyState className="mt-4" title="Título" description="Descripción" />);
    expect(screen.getByRole("heading", { name: "Título" }).parentElement).toHaveClass("mt-4");
  });
});