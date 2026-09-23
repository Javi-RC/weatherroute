import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addHistoryEntry,
  clearHistory,
  HISTORY_KEY,
  listHistoryEntries,
  removeHistoryEntry,
  type HistoryEntry,
  type NewHistoryEntry,
} from "./storage";

function entry(overrides: Partial<NewHistoryEntry> = {}): NewHistoryEntry {
  return {
    origin: "Ciudad Real",
    destination: "Almagro",
    activity: "Cycling",
    departureTimeUtc: "2026-09-22T10:00:00.000Z",
    maxDurationMinutes: null,
    ...overrides,
  };
}

function persisted(): HistoryEntry[] {
  return JSON.parse(window.localStorage.getItem(HISTORY_KEY)!);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("listHistoryEntries", () => {
  it("returns [] when nothing is stored", () => {
    expect(listHistoryEntries()).toEqual([]);
  });

  it("ignores corrupted JSON and non-array payloads", () => {
    window.localStorage.setItem(HISTORY_KEY, "{oops");
    expect(listHistoryEntries()).toEqual([]);

    window.localStorage.setItem(HISTORY_KEY, JSON.stringify({ not: "an array" }));
    expect(listHistoryEntries()).toEqual([]);
  });

  it("filters out entries with an invalid shape", () => {
    const valid = addHistoryEntry(entry())[0];
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        valid,
        { ...valid, activity: "Teleport" },
        { id: 3 },
        null,
        { ...valid, origin: 42 },
        { ...valid, savedAt: undefined },
      ]),
    );
    expect(listHistoryEntries()).toEqual([valid]);
  });
});

describe("addHistoryEntry", () => {
  const now = new Date(2026, 8, 22, 12, 0, 0);

  it("stores a fresh entry with an id and savedAt, newest first", () => {
    const first = addHistoryEntry(entry(), now);
    const second = addHistoryEntry(
      entry({ origin: "Puertollano", destination: "Miguelturra" }),
      now,
    );

    expect(first).toHaveLength(1);
    expect(first[0].id).toBeTruthy();
    expect(first[0].savedAt).toBe(now.toISOString());

    expect(second).toHaveLength(2);
    expect(second[0].origin).toBe("Puertollano");
    expect(second[1].origin).toBe("Ciudad Real");
    expect(persisted()).toEqual(second);
  });

  it("dedupes by origin, destination, activity and departureTimeUtc, bumping savedAt", () => {
    const first = addHistoryEntry(
      entry({ maxDurationMinutes: 120 }),
      new Date(2026, 8, 22, 10, 0, 0),
    );
    const later = new Date(2026, 8, 22, 11, 30, 0);
    const second = addHistoryEntry(entry({ maxDurationMinutes: 90 }), later);

    expect(second).toHaveLength(1);
    expect(second[0].id).not.toBe(first[0].id);
    expect(second[0].maxDurationMinutes).toBe(90);
    expect(second[0].savedAt).toBe(later.toISOString());
    expect(persisted()).toEqual(second);
  });

  it("keeps distinct searches as separate entries even when places match", () => {
    addHistoryEntry(entry({ departureTimeUtc: "2026-09-22T10:00:00.000Z" }), now);
    const list = addHistoryEntry(
      entry({ departureTimeUtc: "2026-09-23T08:00:00.000Z" }),
      now,
    );
    expect(list).toHaveLength(2);
  });

  it("caps the history to 10 newest entries", () => {
    let list: HistoryEntry[] = [];
    for (let index = 0; index < 12; index += 1) {
      list = addHistoryEntry(entry({ origin: `Origen ${index}` }), now);
    }

    expect(list).toHaveLength(10);
    expect(list[0].origin).toBe("Origen 11");
    expect(list[9].origin).toBe("Origen 2");
    expect(persisted()).toEqual(list);
  });

  it("does not throw when localStorage.setItem throws (private mode)", () => {
    vi.spyOn(Object.getPrototypeOf(window.localStorage), "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    const result = addHistoryEntry(entry(), now);
    expect(result).toHaveLength(1);
    expect(result[0].origin).toBe("Ciudad Real");
  });

  it("generates a fresh id per stored entry", () => {
    addHistoryEntry(entry(), now);
    const list = addHistoryEntry(entry({ origin: "Daimiel" }), now);
    expect(list[0].id).not.toBe(list[1].id);
  });
});

describe("removeHistoryEntry", () => {
  it("removes the entry with the given id and persists the rest", () => {
    addHistoryEntry(entry(), new Date(2026, 8, 22, 10, 0, 0));
    const list = addHistoryEntry(
      entry({ origin: "Daimiel" }),
      new Date(2026, 8, 22, 11, 0, 0),
    );
    const target = list[1];

    const after = removeHistoryEntry(target.id);

    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(list[0].id);
    expect(persisted()).toEqual(after);
  });

  it("persists the unchanged list when the id is unknown", () => {
    const list = addHistoryEntry(entry());
    const after = removeHistoryEntry("missing");
    expect(after).toEqual(list);
  });

  it("does not throw when localStorage is read-only", () => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([addHistoryEntry(entry())[0]]));
    vi.spyOn(Object.getPrototypeOf(window.localStorage), "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(() => removeHistoryEntry("any")).not.toThrow();
    expect(listHistoryEntries()).toHaveLength(1);
  });
});

describe("clearHistory", () => {
  it("removes the whole history", () => {
    addHistoryEntry(entry());
    clearHistory();

    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
    expect(listHistoryEntries()).toEqual([]);
  });

  it("silently ignores failure to remove (private mode)", () => {
    vi.spyOn(Object.getPrototypeOf(window.localStorage), "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => clearHistory()).not.toThrow();
  });
});