import Sheet from "../ui/Sheet";
import HistoryItem from "./HistoryItem";
import type { HistoryEntry } from "../../lib/storage";

export const HISTORY_EMPTY_STATE = "Aún no hay búsquedas guardadas";

export interface HistorySheetProps {
  open: boolean;
  onClose: () => void;
  entries: HistoryEntry[];
  onRun: (entry: HistoryEntry) => void;
  onRemove: (id: string) => void;
  now?: Date;
}

export default function HistorySheet({
  open,
  onClose,
  entries,
  onRun,
  onRemove,
  now,
}: HistorySheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Historial" position="side">
      {entries.length === 0 ? (
        <p className="py-10 text-center text-sm text-sand-600">{HISTORY_EMPTY_STATE}</p>
      ) : (
        <ul className="flex flex-col gap-2 pb-4">
          {entries.map((entry) => (
            <li key={entry.id}>
              <HistoryItem entry={entry} onRun={onRun} onRemove={onRemove} now={now} />
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}