import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RefreshingIndicator from "./RefreshingIndicator";

describe("RefreshingIndicator", () => {
  it("renders nothing when not refreshing", () => {
    const { container } = render(<RefreshingIndicator visible={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows Actualizando… in a polite status region with a spinner while refreshing", () => {
    render(<RefreshingIndicator visible />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Actualizando…");
    expect(status.querySelector("svg.animate-spin")).toBeInTheDocument();
  });
});