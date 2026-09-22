export type TimePresetId = "now" | "today-18" | "tomorrow-08";

export interface TimePreset {
  readonly id: TimePresetId;
  readonly label: string;
}

export const TIME_PRESETS: readonly TimePreset[] = [
  { id: "now", label: "Ahora" },
  { id: "today-18", label: "Hoy 18:00" },
  { id: "tomorrow-08", label: "Mañana 08:00" },
];

function atLocal(now: Date, dayOffset: number, hour: number): Date {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + dayOffset,
    hour,
    0,
    0,
    0,
  );
}

/** UTC ISO instant for a preset, computed from the local calendar. */
export function presetDeparture(
  preset: TimePresetId,
  now: Date = new Date(),
): string {
  switch (preset) {
    case "now":
      return now.toISOString();
    case "today-18": {
      const today18 = atLocal(now, 0, 18);
      return (today18.getTime() > now.getTime()
        ? today18
        : atLocal(now, 1, 18)
      ).toISOString();
    }
    case "tomorrow-08":
      // Rule: always tomorrow 08:00 local, never clamped to now — a forecast
      // departure slightly in the past is acceptable, and calendar-built
      // tomorrow 08:00 is in practice always ≥ now anyway.
      return atLocal(now, 1, 8).toISOString();
  }
}

/** Start of today (local). */
export function minDate(now: Date = new Date()): Date {
  return atLocal(now, 0, 0);
}

/** Start of today + 7 days (local). */
export function maxDate(now: Date = new Date()): Date {
  return atLocal(now, 7, 0);
}

/** Clamps `date` into [minDate, maxDate]; returns it unchanged when inside. */
export function clampDeparture(date: Date, now: Date = new Date()): Date {
  const min = minDate(now);
  if (date.getTime() < min.getTime()) return min;
  const max = maxDate(now);
  if (date.getTime() > max.getTime()) return max;
  return date;
}

/** Advanced-input fallback: today 08:00 local if still future, else now. */
export function defaultDeparture(now: Date = new Date()): string {
  const today08 = atLocal(now, 0, 8);
  return (today08.getTime() > now.getTime() ? today08 : now).toISOString();
}
