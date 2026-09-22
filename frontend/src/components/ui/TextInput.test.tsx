import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import TextInput from "./TextInput";

describe("TextInput", () => {
  it("forwards its ref to the native input", () => {
    const ref = createRef<HTMLInputElement>();
    render(<TextInput ref={ref} aria-label="Origen" />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toBe(screen.getByLabelText("Origen"));
  });

  it("forwards aria-describedby and aria-invalid to the input", () => {
    render(
      <TextInput
        aria-label="Origen"
        aria-invalid
        aria-describedby="error-1"
        name="origin"
        placeholder="Ciudad Real"
      />,
    );
    const input = screen.getByLabelText("Origen");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "error-1");
    expect(input).toHaveAttribute("name", "origin");
    expect(input).toHaveAttribute("placeholder", "Ciudad Real");
  });

  it("shows the error border when aria-invalid is true", () => {
    const { rerender } = render(<TextInput aria-label="Origen" />);
    const input = screen.getByLabelText("Origen");
    expect(input).toHaveClass("border-sand-300");
    expect(input).not.toHaveClass("border-red-500");

    rerender(<TextInput aria-label="Origen" aria-invalid />);
    expect(input).toHaveClass("border-red-500");
    expect(input).not.toHaveClass("border-sand-300");
  });

  it("shows the error border from the explicit invalid prop", () => {
    render(<TextInput aria-label="Origen" invalid />);
    expect(screen.getByLabelText("Origen")).toHaveClass("border-red-500");
  });

  it("exposes focus-visible ring classes", () => {
    render(<TextInput aria-label="Origen" />);
    const input = screen.getByLabelText("Origen");
    expect(input.className).toContain("focus-visible:ring-2");
    expect(input.className).toContain("focus-visible:ring-ocean-600");
    expect(input.className).toContain("focus-visible:ring-offset-2");
  });
});