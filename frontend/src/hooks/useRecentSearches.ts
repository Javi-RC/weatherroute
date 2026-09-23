import { useCallback, useState } from "react";
import {
  addHistoryEntry,
  clearHistory,
  listHistoryEntries,
  removeHistoryEntry,
  type HistoryEntry,
  type NewHistoryEntry,
} from "../lib/storage";

export interface RecentSearches {
  entries: HistoryEntry[];
  save: (search: NewHistoryEntry) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export function useRecentSearches(): RecentSearches {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => listHistoryEntries());

  const save = useCallback((search: NewHistoryEntry) => {
    setEntries(addHistoryEntry(search));
  }, []);

  const remove = useCallback((id: string) => {
    setEntries(removeHistoryEntry(id));
  }, []);

  const clear = useCallback(() => {
    clearHistory();
    setEntries([]);
  }, []);

  return { entries, save, remove, clear };
}