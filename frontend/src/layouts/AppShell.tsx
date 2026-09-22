import type { ReactNode } from "react";
import Header from "../components/Header";

export interface AppShellProps {
  children?: ReactNode;
  plannerSlot?: ReactNode;
  resultsSlot?: ReactNode;
  onOpenAbout?: () => void;
  onOpenHistory?: () => void;
}

export default function AppShell({
  children,
  plannerSlot,
  resultsSlot,
  onOpenAbout,
  onOpenHistory,
}: AppShellProps) {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-sand-50">
      <Header onOpenAbout={onOpenAbout} onOpenHistory={onOpenHistory} />
      <main id="contenido" className="absolute inset-0">
        <div data-testid="app-shell-map" className="absolute inset-0">
          {children}
        </div>
        {plannerSlot && (
          <aside
            data-testid="app-shell-planner"
            className="absolute left-4 top-24 z-10 w-full max-w-sm sm:left-6"
            aria-label="Planificador de ruta"
          >
            {plannerSlot}
          </aside>
        )}
        {resultsSlot && (
          <aside
            data-testid="app-shell-results"
            className="absolute right-4 top-24 z-10 w-full max-w-md sm:right-6"
            aria-label="Resultados"
          >
            {resultsSlot}
          </aside>
        )}
      </main>
    </div>
  );
}