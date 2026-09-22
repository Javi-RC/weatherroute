import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SegmentedControl from "./SegmentedControl";

const OPTIONS = [
  { label: "Ahora", value: "now" },
  { label: "Hoy 18:00", value: "today-18" },
  { label: "Mañana 08:00", value: "tomorrow-08" },
];

describe("SegmentedControl", () => {
  it("renders every option as a toggle button", () => {
    render(<SegmentedControl options={OPTIONS} value="now" onChange={vi.fn()} />);
    for (const option of OPTIONS) {
      expect(screen.getByRole("button", { name: option.label })).toBeInTheDocument();
    }
  });

  it("marks selection with aria-pressed", () => {
    render(<SegmentedControl options={OPTIONS} value="today-18" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Ahora" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Hoy 18:00" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Mañana 08:00" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("emits the clicked value", async () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={OPTIONS} value="now" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Mañana 08:00" }));
    expect(onChange).toHaveBeenCalledWith("tomorrow-08");
  });

  it("labels the group and enforces ≥40px targets", () => {
    render(
      <SegmentedControl
        options={OPTIONS}
        value="now"
        onChange={vi.fn()}
        ariaLabel="Momento de salida"
      />,
    );
    expect(screen.getByRole("group", { name: "Momento de salida" })).toBeInTheDocument();
    for (const option of OPTIONS) {
      expect(screen.getByRole("button", { name: option.label }).className).toContain(
        "min-h-10",
      );
    }
  });

  it("exposes focus-visible ring classes on its chips", () => {
    render(<SegmentedControl options={OPTIONS} value="now" onChange={vi.fn()} />);
    const chip = screen.getByRole("button", { name: "Ahora" });
    expect(chip.className).toContain("focus-visible:ring-2");
    expect(chip.className).toContain("focus-visible:ring-ocean-600");
    expect(chip.className).toContain("focus-visible:ring-offset-2");
  });
});