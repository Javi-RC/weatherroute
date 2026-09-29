import { useState, type ReactNode } from "react";
import Sheet from "../ui/Sheet";

export interface SidebarProps {
  children: ReactNode;
  isCompact: boolean;
}

export const SIDEBAR_LABEL = "Planificador de rutas";

export default function Sidebar({ children, isCompact }: SidebarProps) {
  const [open, setOpen] = useState(false);

  if (!isCompact) {
    return (
      <aside
        aria-label={SIDEBAR_LABEL}
        className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-r border-sand-200 bg-white xl:w-[400px]"
      >
        {children}
      </aside>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full bg-ocean-600 px-4 text-sm font-semibold text-white shadow-raise transition-colors hover:bg-ocean-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600 focus-visible:ring-offset-2"
      >
        Planificador
      </button>
      <Sheet open={open} position="bottom" title="Planificador de rutas" onClose={() => setOpen(false)}>
        {children}
      </Sheet>
    </>
  );
}
