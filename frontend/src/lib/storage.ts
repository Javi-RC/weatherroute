import type { ActivityType } from "../types";

export interface HistoryEntry {
  id: string;
  origin: string;
  destination: string;
  activity: ActivityType;
  departureTimeUtc: string;
  maxDurationMinutes: number | null;
  savedAt: string;
}

export type NewHistoryEntry = Omit<HistoryEntry, "id" | "savedAt">;

export const HISTORY_KEY = "weatherroute:history";
export const HISTORY_LIMIT = 10;

const ACTIVITY_TYPES: readonly ActivityType[] = [
  "Walking",
  "Running",
  "Cycling",
  "Motorcycle",
  "Driving",
];

function generateId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to the non-crypto fallback
  }
  return `history-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.origin === "string" &&
    typeof entry.destination === "string" &&
    typeof entry.activity === "string" &&
    (ACTIVITY_TYPES as readonly string[]).includes(entry.activity) &&
    typeof entry.departureTimeUtc === "string" &&
    (typeof entry.maxDurationMinutes === "number" || entry.maxDurationMinutes === null) &&
    typeof entry.savedAt === "string"
  );
}

function safeRead(): HistoryEntry[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(HISTORY_KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryEntry);
  } catch {
    return [];
  }
}

function safeWrite(entries: HistoryEntry[]): HistoryEntry[] {
  const capped = entries.slice(0, HISTORY_LIMIT);
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(capped));
  } catch {
    // private mode / quota: persist nothing, keep the in-memory result
  }
  return capped;
}

function sameSearch(
  entry: HistoryEntry,
  search: Pick<HistoryEntry, "origin" | "destination" | "activity" | "departureTimeUtc">,
): boolean {
  return (
    entry.origin === search.origin &&
    entry.destination === search.destination &&
    entry.activity === search.activity &&
    entry.departureTimeUtc === search.departureTimeUtc
  );
}

export function listHistoryEntries(): HistoryEntry[] {
  return safeRead();
}

export function addHistoryEntry(
  search: NewHistoryEntry,
  now: Date = new Date(),
): HistoryEntry[] {
  const current = safeRead();
  const next = [
    { ...search, id: generateId(), savedAt: now.toISOString() },
    ...current.filter((entry) => !sameSearch(entry, search)),
  ];
  return safeWrite(next);
}

export function removeHistoryEntry(id: string): HistoryEntry[] {
  const next = safeRead().filter((entry) => entry.id !== id);
  return safeWrite(next);
}

export function clearHistory(): void {
  try {
    window.localStorage.removeItem(HISTORY_KEY);
  } catch {
    // private mode: nothing to clear
  }
}