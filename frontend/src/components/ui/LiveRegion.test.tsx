import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LiveRegion from "./LiveRegion";

describe("LiveRegion", () => {
  it("announces a message politely", () => {
    render(<LiveRegion message="Origen fijado en Madrid" />);
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("Origen fijado en Madrid");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("renders nothing visible when there is no message", () => {
    const { container } = render(<LiveRegion message={null} />);
    expect(container.firstElementChild).toBeNull();
  });
});