import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Toast, { TOAST_AUTO_DISMISS_MS } from "./Toast";

function renderToast(overrides: Partial<Parameters<typeof Toast>[0]> = {}) {
  const onDismiss = vi.fn();
  const utils = render(
    <Toast
      id={1}
      kind="info"
      message="Mensaje de prueba"
      onDismiss={onDismiss}
      {...overrides}
    />,
  );
  return { onDismiss, ...utils };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast", () => {
  it("renders the message with an accessible close button", () => {
    renderToast();
    expect(screen.getByText("Mensaje de prueba")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar notificación" })).toBeInTheDocument();
  });

  it("uses role=alert for error toasts", () => {
    renderToast({ kind: "error" });
    expect(screen.getByRole("alert")).toHaveTextContent("Mensaje de prueba");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("uses role=status for info, warning and success toasts", () => {
    const { rerender } = render(
      <Toast id={1} kind="info" message="Información" onDismiss={vi.fn()} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Información");
    rerender(<Toast id={1} kind="warning" message="Aviso" onDismiss={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Aviso");
    rerender(<Toast id={1} kind="success" message="Éxito" onDismiss={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Éxito");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("auto-dismisses after 5 seconds", () => {
    vi.useFakeTimers();
    const { onDismiss } = renderToast();
    act(() => {
      vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS - 1);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledWith(1);
  });

  it("cleans up its dismissal timer when unmounted", () => {
    vi.useFakeTimers();
    const { onDismiss, unmount } = renderToast();
    unmount();
    act(() => {
      vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS + 10);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("dismisses immediately when the close button is clicked", async () => {
    const { onDismiss } = renderToast();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Cerrar notificación" }));
    expect(onDismiss).toHaveBeenCalledWith(1);
  });
});