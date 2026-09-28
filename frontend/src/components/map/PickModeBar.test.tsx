import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PickModeBar from "./PickModeBar";

describe("PickModeBar", () => {
  it("marks the active mode with aria-pressed", () => {
    render(<PickModeBar pickMode="origin" onChange={vi.fn()} onFitView={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Origen" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Destino" })).toHaveAttribute("aria-pressed", "false");
  });

  it("emits the chosen mode", async () => {
    const onChange = vi.fn();
    render(<PickModeBar pickMode="none" onChange={onChange} onFitView={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Destino" }));

    expect(onChange).toHaveBeenCalledWith("destination");
  });

  it("keeps the waypoint button disabled in phase 1", () => {
    render(<PickModeBar pickMode="none" onChange={vi.fn()} onFitView={vi.fn()} />);

    const waypoint = screen.getByRole("button", { name: /Vía/ });
    expect(waypoint).toBeDisabled();
    expect(waypoint).toHaveAttribute("title", "Llega en la Fase 2");
  });

  it("exposes the fit-view action", async () => {
    const onFitView = vi.fn();
    render(<PickModeBar pickMode="none" onChange={vi.fn()} onFitView={onFitView} />);

    await userEvent.click(screen.getByRole("button", { name: "Ajustar vista" }));

    expect(onFitView).toHaveBeenCalled();
  });

  it("moves between modes with the arrow keys", async () => {
    const onChange = vi.fn();
    render(<PickModeBar pickMode="none" onChange={onChange} onFitView={vi.fn()} />);
    screen.getByRole("button", { name: "Origen" }).focus();

    await userEvent.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("destination");
  });

  it("wraps backwards with the left arrow", async () => {
    const onChange = vi.fn();
    render(<PickModeBar pickMode="origin" onChange={onChange} onFitView={vi.fn()} />);
    screen.getByRole("button", { name: "Origen" }).focus();

    await userEvent.keyboard("{ArrowLeft}");

    expect(onChange).toHaveBeenCalledWith("destination");
  });

  it("moves focus with the active mode", async () => {
    render(<PickModeBar pickMode="origin" onChange={vi.fn()} onFitView={vi.fn()} />);
    screen.getByRole("button", { name: "Origen" }).focus();

    await userEvent.keyboard("{ArrowRight}");

    expect(screen.getByRole("button", { name: "Destino" })).toHaveFocus();
  });
});
