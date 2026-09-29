import type { ReactNode } from "react";
import Sidebar from "../components/layout/Sidebar";

export interface AppShellProps {
  headerSlot?: ReactNode;
  sidebarSlot?: ReactNode;
  children?: ReactNode;
  isCompact?: boolean;
  welcomeSlot?: ReactNode;
  legendSlot?: ReactNode;
}

export default function AppShell({
  headerSlot,
  sidebarSlot,
  children,
  isCompact = false,
  welcomeSlot,
  legendSlot,
}: AppShellProps) {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-sand-50">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ocean-700 focus:shadow-raise focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600 focus-visible:ring-offset-2"
      >
        Saltar al mapa
      </a>
      {headerSlot && <div className="h-16 shrink-0">{headerSlot}</div>}
      <div className="flex min-h-0 flex-1">
        {sidebarSlot && <Sidebar isCompact={isCompact}>{sidebarSlot}</Sidebar>}
        <main id="contenido" className="relative flex-1 min-w-0">
          {children}
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
        </main>
      </div>
    </div>
  );
}
