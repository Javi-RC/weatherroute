import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider, useToasts } from "./useToasts";

function Harness() {
  const { addToast } = useToasts();
  return (
    <>
      <button type="button" onClick={() => addToast("info", "Mensaje informativo")}>
        Añadir info
      </button>
      <button type="button" onClick={() => addToast("error", "Error de red")}>
        Añadir error
      </button>
      <button type="button" onClick={() => addToast("success", "Mensaje informativo")}>
        Añadir éxito
      </button>
    </>
  );
}

function renderProvider() {
  return render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );
}

describe("useToasts", () => {
  it("throws when used outside the provider", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    function Broken() {
      useToasts();
      return null;
    }
    expect(() => render(<Broken />)).toThrow(
      "useToasts debe utilizarse dentro de un <ToastProvider>.",
    );
    error.mockRestore();
  });

  it("adds a toast via addToast(kind, message)", async () => {
    const user = userEvent.setup();
    renderProvider();
    await user.click(screen.getByRole("button", { name: "Añadir info" }));
    expect(screen.getByRole("status")).toHaveTextContent("Mensaje informativo");
  });

  it("stacks toasts of different kinds side by side", async () => {
    const user = userEvent.setup();
    renderProvider();
    await user.click(screen.getByRole("button", { name: "Añadir éxito" }));
    await user.click(screen.getByRole("button", { name: "Añadir error" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Error de red");
    expect(screen.getByRole("status")).toHaveTextContent("Mensaje informativo");
  });

  it("deduplicates identical kind+message pairs already on screen", async () => {
    const user = userEvent.setup();
    renderProvider();
    await user.click(screen.getByRole("button", { name: "Añadir info" }));
    await user.click(screen.getByRole("button", { name: "Añadir info" }));
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("keeps distinct messages even when the kind matches", async () => {
    const user = userEvent.setup();
    renderProvider();
    await user.click(screen.getByRole("button", { name: "Añadir info" }));
    await user.click(screen.getByRole("button", { name: "Añadir éxito" }));
    expect(screen.getAllByRole("status")).toHaveLength(2);
  });
});