export interface SegmentOption {
  label: string;
  value: string;
}

export interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
}

const BASE_CLASSES =
  "min-h-10 rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600 focus-visible:ring-offset-2";

export default function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={["inline-flex flex-wrap items-center gap-1 rounded-lg border border-sand-200 bg-sand-100 p-1", className]
        .filter(Boolean)
        .join(" ")}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={[
              BASE_CLASSES,
              selected
                ? "bg-white text-ocean-800 shadow-sm"
                : "text-sand-600 hover:bg-white/60 hover:text-sand-800",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}