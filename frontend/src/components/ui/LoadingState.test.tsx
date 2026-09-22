import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoadingState from "./LoadingState";

describe("LoadingState", () => {
  it("exposes a status region with a visually-hidden default label", () => {
    render(<LoadingState />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Cargando…");
  });

  it("renders skeleton bars shaped like a route card", () => {
    render(<LoadingState />);
    const bars = screen.getAllByTestId("skeleton-bar");
    expect(bars.length).toBeGreaterThanOrEqual(5);
    bars.forEach((bar) => {
      expect(bar.className).toContain("animate-pulse");
      expect(bar.className).toContain("bg-sand-200");
    });
  });

  it("accepts a custom label", () => {
    render(<LoadingState label="Analizando condiciones…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Analizando condiciones…");
  });
});