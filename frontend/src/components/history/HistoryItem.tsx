import { FaRoute, FaTrash } from "react-icons/fa";
import { ACTIVITY_OPTIONS } from "../planner/ActivityPicker";
import { formatSavedAt } from "../../lib/format";
import type { HistoryEntry } from "../../lib/storage";
import IconButton from "../ui/IconButton";

export interface HistoryItemProps {
  entry: HistoryEntry;
  onRun: (entry: HistoryEntry) => void;
  onRemove: (id: string) => void;
  now?: Date;
}

export default function HistoryItem({ entry, onRun, onRemove, now }: HistoryItemProps) {
  const option = ACTIVITY_OPTIONS.find((candidate) => candidate.value === entry.activity);
  const Icon = option?.icon ?? FaRoute;
  const activityLabel = option?.label ?? entry.activity;
  const relativeTime = formatSavedAt(new Date(entry.savedAt), now ?? new Date());

  return (
    <div
      data-testid="history-item"
      className="group flex items-stretch gap-1 rounded-lg border border-sand-200 bg-white transition-colors hover:border-sand-300"
    >
      <button
        type="button"
        onClick={() => onRun(entry)}
        aria-label={`Repetir búsqueda de ${entry.origin} a ${entry.destination}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600 focus-visible:ring-offset-2"
      >
        <Icon aria-hidden className="size-5 shrink-0 text-ocean-600" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-sand-900">
            {entry.origin} → {entry.destination}
          </span>
          <span className="block truncate text-xs text-sand-600">
            {activityLabel} · {relativeTime}
          </span>
        </span>
      </button>
      <div className="flex items-center pr-1">
        <IconButton
          label={`Eliminar búsqueda de ${entry.origin} a ${entry.destination}`}
          onClick={() => onRemove(entry.id)}
          className="size-9 text-sand-500 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <FaTrash aria-hidden />
        </IconButton>
      </div>
    </div>
  );
}