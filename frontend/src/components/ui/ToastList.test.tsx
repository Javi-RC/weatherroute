import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ToastList from "./ToastList";
import type { ToastData } from "./Toast";

const toast = (id: number, kind: ToastData["kind"], message: string): ToastData => ({
  id,
  kind,
  message,
});

describe("ToastList", () => {
  it("renders nothing while the stack is empty", () => {
    const { container } = render(<ToastList toasts={[]} onDismiss={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders every toast in the stack in a polite aria-live region", () => {
    render(
      <ToastList
        toasts={[
          toast(1, "info", "Primer mensaje"),
          toast(2, "error", "Segundo mensaje"),
        ]}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("Primer mensaje")).toBeInTheDocument();
    expect(screen.getByText("Segundo mensaje")).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Segundo mensaje");
    const region = screen.getByText("Primer mensaje").closest('[aria-live="polite"]');
    expect(region).not.toBeNull();
  });

  it("anchors the stack top-center on mobile and bottom-right on desktop", () => {
    const { container } = render(
      <ToastList toasts={[toast(1, "info", "Aviso")]} onDismiss={vi.fn()} />,
    );
    const region = container.firstElementChild as HTMLElement;
    expect(region.className).toContain("fixed");
    expect(region.className).toContain("top-4");
    expect(region.className).toContain("inset-x-0");
    expect(region.className).toContain("md:bottom-6");
    expect(region.className).toContain("md:right-6");
    expect(region.className).toContain("md:top-auto");
  });

  it("wires each close button to the dismissal with its own id", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(
      <ToastList
        toasts={[
          toast(3, "info", "Primer mensaje"),
          toast(8, "error", "Segundo mensaje"),
        ]}
        onDismiss={onDismiss}
      />,
    );
    const closeButtons = screen.getAllByRole("button", { name: "Cerrar notificación" });
    await user.click(closeButtons[1]);
    expect(onDismiss).toHaveBeenCalledWith(8);
    await user.click(closeButtons[0]);
    expect(onDismiss).toHaveBeenCalledWith(3);
  });
});