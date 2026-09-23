import {
  FaBiking,
  FaCar,
  FaMotorcycle,
  FaRunning,
  FaWalking,
} from "react-icons/fa";
import type { ComponentType, KeyboardEvent } from "react";
import type { ActivityType } from "../../types";

export interface ActivityOption {
  value: ActivityType;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export const ACTIVITY_OPTIONS: readonly ActivityOption[] = [
  { value: "Walking", label: "Caminar", icon: FaWalking },
  { value: "Running", label: "Correr", icon: FaRunning },
  { value: "Cycling", label: "Bici", icon: FaBiking },
  { value: "Motorcycle", label: "Moto", icon: FaMotorcycle },
  { value: "Driving", label: "Coche", icon: FaCar },
];

export interface ActivityPickerProps {
  value: ActivityType;
  onChange: (value: ActivityType) => void;
}

export default function ActivityPicker({ value, onChange }: ActivityPickerProps) {
  function moveTo(index: number) {
    const next = (index + ACTIVITY_OPTIONS.length) % ACTIVITY_OPTIONS.length;
    onChange(ACTIVITY_OPTIONS[next].value);
    document.getElementById(`activity-${ACTIVITY_OPTIONS[next].value}`)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = ACTIVITY_OPTIONS.findIndex((option) => option.value === value);
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        moveTo(current + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        moveTo(current - 1);
        break;
      case "Home":
        event.preventDefault();
        moveTo(0);
        break;
      case "End":
        event.preventDefault();
        moveTo(ACTIVITY_OPTIONS.length - 1);
        break;
    }
  }

  return (
    <div
      role="group"
      aria-label="Actividad"
      onKeyDown={handleKeyDown}
      className="grid grid-cols-5 gap-1.5"
    >
      {ACTIVITY_OPTIONS.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            id={`activity-${option.value}`}
            type="button"
            aria-pressed={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={[
              "flex min-h-10 flex-col items-center justify-center gap-1 rounded-md border px-1 py-2 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600 focus-visible:ring-offset-2",
              selected
                ? "border-ocean-600 bg-ocean-600 text-white"
                : "border-sand-200 bg-white text-sand-600 hover:bg-sand-50 hover:text-sand-800",
            ].join(" ")}
          >
            <Icon aria-hidden className="text-lg" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
