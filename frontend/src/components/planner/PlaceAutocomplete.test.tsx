import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../services/api";
import * as api from "../../services/api";
import type { PlaceCandidate } from "../../types";
import PlaceAutocomplete from "./PlaceAutocomplete";

function Controlled({ onSelect = vi.fn(), onSearchError = vi.fn() } = {}) {
  const [value, setValue] = useState("");
  return (
    <PlaceAutocomplete
      value={value}
      onChange={setValue}
      onSelect={onSelect}
      onSearchError={onSearchError}
      placeholder="Ciudad de salida"
    />
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("PlaceAutocomplete", () => {
  it("does not search until 2 characters are typed and debounces by 250ms", async () => {
    const user = userEvent.setup();
    const searchPlaces = vi.spyOn(api, "searchPlaces").mockResolvedValue([]);
    render(<Controlled />);

    await user.type(screen.getByRole("combobox"), "C");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(searchPlaces).not.toHaveBeenCalled();

    await user.type(screen.getByRole("combobox"), "i");
    expect(searchPlaces).not.toHaveBeenCalled();
    await waitFor(() => expect(searchPlaces).toHaveBeenCalledTimes(1));
    expect(searchPlaces).toHaveBeenCalledWith("Ci");
  });

  it("renders results as a listbox capped implicitly by the API response", async () => {
    const user = userEvent.setup();
    const results: PlaceCandidate[] = [
      { label: "Ciudad Real, España", lat: 38.9861, lon: -3.9292 },
      { label: "Ciudad Rodrigo, España", lat: 40.6, lon: -6.53 },
    ];
    vi.spyOn(api, "searchPlaces").mockResolvedValue(results);
    render(<Controlled />);

    await user.type(screen.getByRole("combobox"), "Ciudad");

    const listbox = await screen.findByRole("listbox");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("Ciudad Real, España");
    expect(listbox).toBeInTheDocument();
  });

  it("shows a not-found message when the search returns no results", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "searchPlaces").mockResolvedValue([]);
    render(<Controlled />);

    await user.type(screen.getByRole("combobox"), "Xyzxyz");

    expect(await screen.findByText("No encontramos ese lugar")).toBeInTheDocument();
  });

  it("cycles the active option with arrow keys and selects it with Enter", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const results: PlaceCandidate[] = [
      { label: "Ciudad Real, España", lat: 38.9861, lon: -3.9292 },
      { label: "Ciudad Rodrigo, España", lat: 40.6, lon: -6.53 },
    ];
    vi.spyOn(api, "searchPlaces").mockResolvedValue(results);
    render(<Controlled onSelect={onSelect} />);

    const input = screen.getByRole("combobox");
    await user.type(input, "Ciudad");
    await screen.findByRole("listbox");

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onSelect).toHaveBeenCalledWith(results[1]);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes without selecting on Escape", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    vi.spyOn(api, "searchPlaces").mockResolvedValue([
      { label: "Ciudad Real, España", lat: 38.9861, lon: -3.9292 },
    ]);
    render(<Controlled onSelect={onSelect} />);

    await user.type(screen.getByRole("combobox"), "Ciudad");
    await screen.findByRole("listbox");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls onSearchError and does not throw when the search fails", async () => {
    const user = userEvent.setup();
    const onSearchError = vi.fn();
    vi.spyOn(api, "searchPlaces").mockRejectedValue(new ApiError("search_failed", "boom"));
    render(<Controlled onSearchError={onSearchError} />);

    await user.type(screen.getByRole("combobox"), "Ciudad");

    await waitFor(() => expect(onSearchError).toHaveBeenCalledTimes(1));
  });
});
