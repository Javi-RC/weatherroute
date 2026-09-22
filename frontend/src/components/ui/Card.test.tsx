import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Card from "./Card";

describe("Card", () => {
  it("renders its children", () => {
    render(
      <Card>
        <h2>Ruta 1</h2>
      </Card>,
    );
    expect(screen.getByRole("heading", { name: "Ruta 1" })).toBeInTheDocument();
  });

  it("uses the token radius, shadow and default padding", () => {
    render(<Card>Contenido</Card>);
    const card = screen.getByText("Contenido");
    expect(card).toHaveClass("rounded-lg", "shadow-card", "bg-white", "p-5");
  });

  it("honors the padding prop", () => {
    render(<Card padding="none">Sin padding</Card>);
    expect(screen.getByText("Sin padding")).toHaveClass("p-0");
  });

  it("merges extra classes and HTML attributes", () => {
    render(
      <Card data-testid="card" className="mt-4" aria-labelledby="t">
        Contenido
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("mt-4", "shadow-card");
    expect(card).toHaveAttribute("aria-labelledby", "t");
  });
});