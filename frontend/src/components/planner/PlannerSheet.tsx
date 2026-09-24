import { useState } from "react";
import Sheet from "../ui/Sheet";
import PlannerForm, { type PlannerSearch } from "./PlannerForm";

export interface PlannerSheetProps {
  busy: boolean;
  onSearch: (search: PlannerSearch) => void;
  onLocationError?: () => void;
  isCompact?: boolean;
}

export default function PlannerSheet({
  busy,
  onSearch,
  onLocationError,
  isCompact = false,
}: PlannerSheetProps) {
  const [open, setOpen] = useState(false);

  function handleSearch(search: PlannerSearch) {
    setOpen(false);
    onSearch(search);
  }

  if (!isCompact) {
    return (
      <section
        data-testid="planner-sheet"
        aria-label="Planificador de ruta"
        className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-raise"
      >
        <header className="border-b border-sand-100 px-5 py-4">
          <h2 className="text-lg font-bold text-sand-900">Planificador</h2>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          <PlannerForm onSearch={onSearch} onLocationError={onLocationError} busy={busy} />
        </div>
      </section>
    );
  }

  if (open) {
    return (
      <Sheet
        open
        position="bottom"
        title="Planificador"
        onClose={() => setOpen(false)}
      >
        <PlannerForm onSearch={handleSearch} onLocationError={onLocationError} busy={busy} />
      </Sheet>
    );
  }

  return (
    <div data-testid="planner-fab" className="fixed inset-x-0 bottom-4 z-40 flex justify-center">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-ocean-600 px-5 py-2.5 text-sm font-semibold text-white shadow-raise transition-colors hover:bg-ocean-700 active:bg-ocean-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
      >
        {busy ? "Calculando…" : "Planificar ruta"}
      </button>
    </div>
  );
}