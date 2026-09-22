import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ButtonHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import Tooltip from "./Tooltip";

function Trigger(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props}>
      ¿Cómo se calcula?
    </button>
  );
}

function getTip(container: HTMLElement): HTMLElement {
  const tip = container.querySelector('[role="tooltip"]');
  expect(tip).not.toBeNull();
  return tip as HTMLElement;
}

describe("Tooltip", () => {
  it("renders a role=tooltip element that is hidden by default", () => {
    const { container } = render(
      <Tooltip label="Más alto = mejores condiciones">
        <Trigger />
      </Tooltip>,
    );
    const tip = getTip(container);
    expect(tip).toHaveTextContent("Más alto = mejores condiciones");
    expect(tip).toHaveAttribute("aria-hidden", "true");
    expect(tip.className).toContain("invisible");
  });

  it("opens on focus and wires aria-describedby to the trigger", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Tooltip label="Más alto = mejores condiciones">
        <Trigger />
      </Tooltip>,
    );
    const trigger = screen.getByRole("button");
    const tip = getTip(container);

    await user.tab();
    expect(trigger).toHaveFocus();
    expect(tip).toHaveAttribute("aria-hidden", "false");
    expect(tip.className).toContain("opacity-100");
    expect(trigger).toHaveAttribute("aria-describedby", tip.id);

    await user.tab();
    expect(tip).toHaveAttribute("aria-hidden", "true");
    expect(trigger).not.toHaveAttribute("aria-describedby");
  });

  it("opens on hover and closes on mouse leave", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Tooltip label="Detalle del tramo">
        <Trigger />
      </Tooltip>,
    );
    const trigger = screen.getByRole("button");
    const tip = getTip(container);

    await user.hover(trigger);
    expect(tip).toHaveAttribute("aria-hidden", "false");

    await user.unhover(trigger);
    expect(tip).toHaveAttribute("aria-hidden", "true");
  });

  it("preserves the trigger's own click handler", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const trigger = (
      <button type="button" onClick={onClick}>
        Abrir
      </button>
    );
    render(<Tooltip label="Ayuda">{trigger}</Tooltip>);

    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});