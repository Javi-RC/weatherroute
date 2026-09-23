import type { ReactNode } from "react";
import Header from "../components/Header";

export interface AppShellProps {
  children?: ReactNode;
  isCompact?: boolean;
  plannerSlot?: ReactNode;
  resultsSlot?: ReactNode;
  welcomeSlot?: ReactNode;
  legendSlot?: ReactNode;
  onOpenAbout?: () => void;
  onOpenHistory?: () => void;
}

export default function AppShell({
  children,
  isCompact = false,
  plannerSlot,
  resultsSlot,
  welcomeSlot,
  legendSlot,
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
        {welcomeSlot && (
          <div
            data-testid="app-shell-welcome"
            className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center p-4"
          >
            <div className="pointer-events-auto">{welcomeSlot}</div>
          </div>
        )}
        {legendSlot && (
          <div
            data-testid="app-shell-legend"
            className={[
              "absolute bottom-4 z-10",
              isCompact ? "right-4" : "left-1/2 -translate-x-1/2",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {legendSlot}
          </div>
        )}
        {plannerSlot &&
          (isCompact ? (
            <div data-testid="app-shell-planner">{plannerSlot}</div>
          ) : (
            <aside
              data-testid="app-shell-planner"
              aria-label="Planificador de ruta"
              className="absolute left-4 top-24 bottom-4 z-20 w-[27rem] max-w-[calc(100%-2rem)]"
            >
              {plannerSlot}
            </aside>
          ))}
        {resultsSlot &&
          (isCompact ? (
            <aside
              data-testid="app-shell-results"
              aria-label="Resultados"
              className="absolute inset-x-3 bottom-20 z-10 max-h-[40vh] overflow-y-auto"
            >
              {resultsSlot}
            </aside>
          ) : (
            <aside
              data-testid="app-shell-results"
              aria-label="Resultados"
              className="absolute right-4 top-24 bottom-4 z-10 w-[25rem] max-w-[calc(100%-2rem)] overflow-y-auto"
            >
              {resultsSlot}
            </aside>
          ))}
      </main>
    </div>
  );
}