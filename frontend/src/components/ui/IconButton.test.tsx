import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FaTimes } from "react-icons/fa";
import { describe, expect, it, vi } from "vitest";
import IconButton from "./IconButton";

describe("IconButton", () => {
  it("exposes an accessible name from the required label prop", () => {
    render(
      <IconButton label="Cerrar">
        <FaTimes />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  });

  it("has a minimum 44px hit area", () => {
    render(
      <IconButton label="Cerrar">
        <FaTimes />
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "Cerrar" });
    expect(button.className).toContain("size-11");
  });

  it("exposes the focus-visible ring classes", () => {
    render(
      <IconButton label="Historial">
        <FaTimes />
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "Historial" });
    expect(button.className).toContain("focus-visible:ring-2");
    expect(button.className).toContain("focus-visible:ring-ocean-600");
    expect(button.className).toContain("focus-visible:ring-offset-2");
  });

  it("fires onClick and honors the disabled state", async () => {
    const onClick = vi.fn();
    render(
      <>
        <IconButton label="Activar" onClick={onClick}>
          <FaTimes />
        </IconButton>
        <IconButton label="Inactivo" disabled>
          <FaTimes />
        </IconButton>
      </>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Activar" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Inactivo" })).toBeDisabled();
  });

  it("defaults to type=button", () => {
    render(
      <IconButton label="Cerrar">
        <FaTimes />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveAttribute("type", "button");
  });
});