import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { HistoryEntry } from "../../lib/storage";
import HistoryItem from "./HistoryItem";

const NOW = new Date(2026, 8, 22, 12, 0, 0);

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: "entry-1",
    origin: "Ciudad Real",
    destination: "Almagro",
    activity: "Cycling",
    departureTimeUtc: "2026-09-22T10:00:00.000Z",
    maxDurationMinutes: 120,
    savedAt: new Date(NOW.getTime() - 5 * 60_000).toISOString(),
    ...overrides,
  };
}

describe("HistoryItem", () => {
  it("renders origin → destination, the Spanish activity label and the relative time", () => {
    render(
      <HistoryItem
        entry={entry()}
        onRun={vi.fn()}
        onRemove={vi.fn()}
        now={NOW}
      />,
    );

    expect(screen.getByText("Ciudad Real → Almagro")).toBeInTheDocument();
    expect(screen.getByText(/Bici/)).toBeInTheDocument();
    expect(screen.getByText(/Hace 5 min/)).toBeInTheDocument();
  });

  it("renders 'Ahora' for entries saved within the last minute", () => {
    render(
      <HistoryItem
        entry={entry({ savedAt: new Date(NOW.getTime() - 20_000).toISOString() })}
        onRun={vi.fn()}
        onRemove={vi.fn()}
        now={NOW}
      />,
    );

    expect(screen.getByText(/Ahora/)).toBeInTheDocument();
  });

  it("re-runs the search when the row action is activated", async () => {
    const entryFixture = entry();
    const onRun = vi.fn();
    render(
      <HistoryItem entry={entryFixture} onRun={onRun} onRemove={vi.fn()} now={NOW} />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Repetir búsqueda de Ciudad Real a Almagro" }),
    );

    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun).toHaveBeenCalledWith(entryFixture);
  });

  it("removes the entry without triggering a re-run when the trash is clicked", async () => {
    const onRun = vi.fn();
    const onRemove = vi.fn();
    render(
      <HistoryItem entry={entry()} onRun={onRun} onRemove={onRemove} now={NOW} />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar búsqueda de Ciudad Real a Almagro" }),
    );

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith("entry-1");
    expect(onRun).not.toHaveBeenCalled();
  });

  it("falls back to the raw activity value for unknown activities", () => {
    render(
      <HistoryItem
        entry={entry({ activity: "Driving" })}
        onRun={vi.fn()}
        onRemove={vi.fn()}
        now={NOW}
      />,
    );

    expect(screen.getByText(/Coche/)).toBeInTheDocument();
  });
});