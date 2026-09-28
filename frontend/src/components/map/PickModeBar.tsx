import { useRef, type KeyboardEvent } from "react";
import type { PickMode } from "./MapCanvas";

export interface PickModeBarProps {
  pickMode: PickMode;
  onChange: (mode: PickMode) => void;
  onFitView: () => void;
}

const MODES: Array<{ mode: PickMode; label: string }> = [
  { mode: "origin", label: "Origen" },
  { mode: "destination", label: "Destino" },
];

export default function PickModeBar({ pickMode, onChange, onFitView }: PickModeBarProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (delta === 0) return;

    event.preventDefault();
    const focusedIndex = refs.current.findIndex((element) => element === document.activeElement);
    const activeIndex =
      focusedIndex >= 0 ? focusedIndex : Math.max(0, MODES.findIndex((entry) => entry.mode === pickMode));
    const nextIndex = (activeIndex + delta + MODES.length) % MODES.length;
    onChange(MODES[nextIndex].mode);
    refs.current[nextIndex]?.focus();
  }

  return (
    <div
      role="toolbar"
      aria-label="Selección de extremos"
      className="pointer-events-auto flex flex-wrap items-center gap-2"
    >
      <div
        role="group"
        onKeyDown={onKeyDown}
        className="flex items-center gap-1 rounded-xl border border-sand-200 bg-white/95 p-1 shadow-raise backdrop-blur"
      >
        {MODES.map((entry, index) => {
          const active = entry.mode === pickMode;
          return (
            <button
              key={entry.mode}
              type="button"
              ref={(element) => {
                refs.current[index] = element;
              }}
              aria-pressed={active}
              onClick={() => onChange(entry.mode)}
              className={[
                "min-h-11 rounded-lg px-4 text-sm font-medium motion-safe:transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600",
                active ? "bg-ocean-600 text-white" : "text-sand-700 hover:bg-sand-100",
              ].join(" ")}
            >
              {entry.label}
            </button>
          );
        })}
        <button
          type="button"
          disabled
          title="Llega en la Fase 2"
          className="min-h-11 cursor-not-allowed rounded-lg px-4 text-sm font-medium text-sand-400"
        >
          + Vía
        </button>
      </div>
      <button
        type="button"
        aria-label="Ajustar vista"
        onClick={onFitView}
        className="min-h-11 rounded-xl border border-sand-200 bg-white/95 px-4 text-sm font-medium text-sand-700 shadow-raise motion-safe:transition-colors hover:bg-sand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600"
      >
        Ajustar vista
      </button>
    </div>
  );
}
