import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HISTORY_KEY, type NewHistoryEntry } from "../lib/storage";
import { useRecentSearches } from "./useRecentSearches";

function search(overrides: Partial<NewHistoryEntry> = {}): NewHistoryEntry {
  return {
    origin: "Ciudad Real",
    destination: "Almagro",
    activity: "Cycling",
    departureTimeUtc: "2026-09-22T10:00:00.000Z",
    maxDurationMinutes: null,
    ...overrides,
  };
}

function seedStorage(origin: string) {
  const seeded = [
    {
      ...search({ origin }),
      id: "seed-id",
      savedAt: "2026-09-22T08:00:00.000Z",
    },
  ];
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(seeded));
  return seeded;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("useRecentSearches", () => {
  it("lazily loads the persisted history once on first render", () => {
    seedStorage("Daimiel");
    const { result } = renderHook(() => useRecentSearches());

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].origin).toBe("Daimiel");
  });

  it("starts empty when nothing is persisted", () => {
    const { result } = renderHook(() => useRecentSearches());
    expect(result.current.entries).toEqual([]);
  });

  it("does not re-read from storage on later renders", () => {
    seedStorage("Daimiel");
    const { result, rerender } = renderHook(() => useRecentSearches());

    seedStorage("Puertollano");
    rerender();

    expect(result.current.entries[0].origin).toBe("Daimiel");
  });

  it("save adds a new entry to the top and persists it", () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.save(search());
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].origin).toBe("Ciudad Real");

    const persisted = JSON.parse(window.localStorage.getItem(HISTORY_KEY)!);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].destination).toBe("Almagro");
  });

  it("save replaces a duplicate search instead of stacking it", () => {
    seedStorage("Ciudad Real");
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.save(search({ maxDurationMinutes: 45 }));
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].maxDurationMinutes).toBe(45);
  });

  it("remove deletes an entry by id and keeps the rest", () => {
    seedStorage("Ciudad Real");
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.remove(result.current.entries[0].id);
    });

    expect(result.current.entries).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem(HISTORY_KEY)!)).toEqual([]);
  });

  it("clear empties the list and removes the stored key", () => {
    seedStorage("Daimiel");
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.clear();
    });

    expect(result.current.entries).toEqual([]);
    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
  });
});