import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Header, { CLAIM_TEXT } from "./Header";

describe("Header", () => {
  it("renders brand, claim and free badge", () => {
    render(<Header />);

    expect(
      screen.getByRole("heading", { level: 1, name: "WeatherRoute" }),
    ).toBeInTheDocument();
    expect(screen.getByText(CLAIM_TEXT)).toBeInTheDocument();
    expect(screen.getByText("Gratis · Sin registro")).toBeInTheDocument();
  });

  it("renders both actions with accessible names", () => {
    render(<Header />);

    expect(
      screen.getByRole("button", { name: "Cómo funciona" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Historial" })).toBeInTheDocument();
  });

  it("exposes a header landmark", () => {
    render(<Header />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("fires the callbacks when actions are activated", async () => {
    const onOpenAbout = vi.fn();
    const onOpenHistory = vi.fn();
    render(<Header onOpenAbout={onOpenAbout} onOpenHistory={onOpenHistory} />);

    await userEvent.click(screen.getByRole("button", { name: "Cómo funciona" }));
    await userEvent.click(screen.getByRole("button", { name: "Historial" }));

    expect(onOpenAbout).toHaveBeenCalledTimes(1);
    expect(onOpenHistory).toHaveBeenCalledTimes(1);
  });

  it("does not throw when callbacks are omitted", () => {
    render(<Header />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });
});