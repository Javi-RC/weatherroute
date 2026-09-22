import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Badge from "./Badge";

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>Gratis · Sin registro</Badge>);
    expect(screen.getByText("Gratis · Sin registro")).toBeInTheDocument();
  });

  it("defaults to the neutral tone", () => {
    render(<Badge>Neutral</Badge>);
    const badge = screen.getByText("Neutral");
    expect(badge).toHaveClass("rounded-full", "bg-sand-100", "text-sand-700");
  });

  it("applies the requested tone classes", () => {
    render(
      <>
        <Badge tone="success">Éxito</Badge>
        <Badge tone="warning">Aviso</Badge>
        <Badge tone="danger">Error</Badge>
        <Badge tone="info">Info</Badge>
      </>,
    );
    expect(screen.getByText("Éxito")).toHaveClass("bg-emerald-100", "text-emerald-800");
    expect(screen.getByText("Aviso")).toHaveClass("bg-amber-100", "text-amber-800");
    expect(screen.getByText("Error")).toHaveClass("bg-red-100", "text-red-800");
    expect(screen.getByText("Info")).toHaveClass("bg-cyan-100", "text-cyan-800");
  });

  it("forwards extra HTML attributes", () => {
    render(
      <Badge data-testid="badge" data-kind="promo">
        Promo
      </Badge>,
    );
    expect(screen.getByTestId("badge")).toHaveAttribute("data-kind", "promo");
  });
});