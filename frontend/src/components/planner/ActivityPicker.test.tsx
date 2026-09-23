import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ActivityType } from "../../types";
import ActivityPicker, { ACTIVITY_OPTIONS } from "./ActivityPicker";

function Harness({ initial }: { initial: ActivityType }) {
  const [value, setValue] = useState(initial);
  return <ActivityPicker value={value} onChange={setValue} />;
}

describe("ActivityPicker", () => {
  it("renders the five activities with their Spanish labels and icons", () => {
    render(<ActivityPicker value="Walking" onChange={vi.fn()} />);
    for (const option of ACTIVITY_OPTIONS) {
      expect(screen.getByRole("button", { name: option.label })).toBeInTheDocument();
    }
    expect(screen.getByRole("group", { name: "Actividad" })).toBeInTheDocument();
  });

  it("marks the selected activity with aria-pressed", () => {
    render(<ActivityPicker value="Cycling" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Bici" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Caminar" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Coche" })).toHaveAttribute("aria-pressed", "false");
  });

  it("emits the backend ActivityType string of the clicked option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ActivityPicker value="Walking" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Moto" }));
    expect(onChange).toHaveBeenCalledWith("Motorcycle");

    await user.click(screen.getByRole("button", { name: "Coche" }));
    expect(onChange).toHaveBeenCalledWith("Driving");
  });

  it("updates aria-pressed when a new value is provided", () => {
    const { rerender } = render(<ActivityPicker value="Walking" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Caminar" })).toHaveAttribute("aria-pressed", "true");

    rerender(<ActivityPicker value="Driving" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Coche" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Caminar" })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps only the selected chip in the tab order", () => {
    render(<ActivityPicker value="Running" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Correr" })).toHaveAttribute("tabindex", "0");
    for (const option of ACTIVITY_OPTIONS) {
      if (option.value === "Running") continue;
      expect(screen.getByRole("button", { name: option.label })).toHaveAttribute("tabindex", "-1");
    }
  });

  it("moves selection and focus with the right arrow key", async () => {
    const user = userEvent.setup();
    render(<Harness initial="Walking" />);
    screen.getByRole("button", { name: "Caminar" }).focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Correr" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Correr" })).toHaveFocus();
  });

  it("wraps from the first activity to the last with the left arrow key", async () => {
    const user = userEvent.setup();
    render(<Harness initial="Walking" />);
    screen.getByRole("button", { name: "Caminar" }).focus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Coche" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Coche" })).toHaveFocus();
  });

  it("Home and End jump to the first and last activity", async () => {
    const user = userEvent.setup();
    render(<Harness initial="Driving" />);
    screen.getByRole("button", { name: "Coche" }).focus();

    await user.keyboard("{Home}");
    expect(screen.getByRole("button", { name: "Caminar" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Caminar" })).toHaveFocus();

    await user.keyboard("{End}");
    expect(screen.getByRole("button", { name: "Coche" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Coche" })).toHaveFocus();
  });

  it("keeps every chip at least 40px tall", () => {
    render(<ActivityPicker value="Walking" onChange={vi.fn()} />);
    for (const option of ACTIVITY_OPTIONS) {
      expect(screen.getByRole("button", { name: option.label }).className).toContain("min-h-10");
    }
  });
});
