import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ErrorState from "./ErrorState";

describe("ErrorState", () => {
  it("announces the error via an alert region with title and message", () => {
    render(
      <ErrorState title="Sin conexión" message="No pudimos calcular la ruta." onRetry={vi.fn()} />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Sin conexión");
    expect(alert).toHaveTextContent("No pudimos calcular la ruta.");
  });

  it("retry button calls onRetry", async () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Fallo" message="Algo salió mal." onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("uses defaults for the title, retry and dismiss labels", () => {
    render(
      <ErrorState
        message="Algo salió mal."
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "Algo salió mal", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mantener búsqueda" })).toBeInTheDocument();
  });

  it("renders the keep-data hint when provided", () => {
    render(
      <ErrorState
        title="Fallo"
        message="Algo salió mal."
        hint="Conservamos tu búsqueda anterior."
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText("Conservamos tu búsqueda anterior.")).toBeInTheDocument();
  });

  it("omits the dismiss action when onDismiss is not provided", () => {
    render(<ErrorState title="Fallo" message="Algo salió mal." onRetry={vi.fn()} />);
    expect(screen.queryByText("Mantener búsqueda")).not.toBeInTheDocument();
  });
});