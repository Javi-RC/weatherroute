import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { HistoryEntry } from "../../lib/storage";
import HistorySheet, { HISTORY_EMPTY_STATE } from "./HistorySheet";

const NOW = new Date(2026, 8, 22, 12, 0, 0);

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: "entry-1",
    origin: "Ciudad Real",
    destination: "Almagro",
    activity: "Cycling",
    departureTimeUtc: "2026-09-22T10:00:00.000Z",
    maxDurationMinutes: null,
    savedAt: new Date(NOW.getTime() - 5 * 60_000).toISOString(),
    ...overrides,
  };
}

function renderSheet(
  overrides: Partial<Parameters<typeof HistorySheet>[0]> = {},
) {
  const props = {
    open: true,
    onClose: vi.fn(),
    entries: [] as HistoryEntry[],
    onRun: vi.fn(),
    onRemove: vi.fn(),
    now: NOW,
    ...overrides,
  };
  render(<HistorySheet {...props} />);
  return props;
}

describe("HistorySheet", () => {
  it("renders a side sheet titled Historial", () => {
    renderSheet();

    expect(screen.getByRole("dialog", { name: "Historial" })).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("inset-y-0", "right-0");
  });

  it("shows the exact empty-state copy when there are no entries", () => {
    renderSheet();

    expect(screen.getByText(HISTORY_EMPTY_STATE)).toBeInTheDocument();
  });

  it("is not in the DOM when closed", () => {
    renderSheet({ open: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lists each entry as a HistoryItem with its relative time", () => {
    renderSheet({
      entries: [
        entry({ id: "a", origin: "Ciudad Real", destination: "Almagro" }),
        entry({
          id: "b",
          origin: "Puertollano",
          destination: "Miguelturra",
          activity: "Driving",
          savedAt: new Date(NOW.getTime() - 2 * 3_600_000).toISOString(),
        }),
      ],
    });

    expect(screen.getByText("Ciudad Real → Almagro")).toBeInTheDocument();
    expect(screen.getByText("Puertollano → Miguelturra")).toBeInTheDocument();
    expect(screen.getAllByText(/Hace 5 min/)).toHaveLength(1);
    expect(screen.getByText(/Hace 2 h/)).toBeInTheDocument();
    expect(screen.queryByText(HISTORY_EMPTY_STATE)).not.toBeInTheDocument();
  });

  it("fires onRun with the clicked entry", async () => {
    const first = entry({ id: "a", origin: "Ciudad Real", destination: "Almagro" });
    const props = renderSheet({ entries: [first] });

    await userEvent.click(
      screen.getByRole("button", { name: "Repetir búsqueda de Ciudad Real a Almagro" }),
    );

    expect(props.onRun).toHaveBeenCalledTimes(1);
    expect(props.onRun).toHaveBeenCalledWith(first);
  });

  it("delegates deletion to onRemove with the entry id", async () => {
    const first = entry({ id: "a" });
    const props = renderSheet({ entries: [first] });

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar búsqueda de Ciudad Real a Almagro" }),
    );

    expect(props.onRemove).toHaveBeenCalledTimes(1);
    expect(props.onRemove).toHaveBeenCalledWith("a");
  });
});