import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AboutModal from "./AboutModal";

describe("AboutModal", () => {
  it("renders nothing when closed", () => {
    render(<AboutModal open={false} onClose={vi.fn()} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the Spanish explanation as a side sheet titled Cómo funciona", () => {
    render(<AboutModal open onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Cómo funciona" })).toBeInTheDocument();
    expect(screen.getByText("Qué es WeatherRoute")).toBeInTheDocument();
    expect(screen.getByText("Índice de condiciones")).toBeInTheDocument();
    expect(screen.getByText("Fuentes gratuitas")).toBeInTheDocument();
    expect(screen.getByText("Sin registro, sin pagos")).toBeInTheDocument();
    expect(screen.getByText("Previsión disponible hasta 7 días.")).toBeInTheDocument();
  });

  it("fires onClose on Escape, delegating to Sheet", async () => {
    const onClose = vi.fn();
    render(<AboutModal open onClose={onClose} />);

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("focuses the score section when opened with focusSection=\"score\"", () => {
    render(<AboutModal open onClose={vi.fn()} focusSection="score" />);

    const section = document.getElementById("about-score");
    expect(section).not.toBeNull();
    expect(document.activeElement).toBe(section);
  });

  it("does not steal focus to the score section when focusSection is omitted", () => {
    render(<AboutModal open onClose={vi.fn()} />);

    const section = document.getElementById("about-score");
    expect(document.activeElement).not.toBe(section);
  });
});
