import { useEffect, useRef, useState } from "react";
import { clampDeparture, defaultDeparture, maxDate, minDate } from "../../lib/time";
import Field from "../ui/Field";

export interface AdvancedOptionsProps {
  value?: string | null;
  onDepartureChange: (iso: string) => void;
  durationMax?: number | null;
  onDurationMaxChange?: (minutes: number | null) => void;
}

const DURATION_MIN = 1;
const DURATION_MAX = 1440;
const DURATION_ERROR = `Entre ${DURATION_MIN} y ${DURATION_MAX} minutos`;

function pad(value: number, length = 2): string {
  return `${value}`.padStart(length, "0");
}

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeInput(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toLocalInputs(iso: string): { date: string; time: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return toLocalInputs(defaultDeparture());
  }
  return { date: toDateInput(date), time: toTimeInput(date) };
}

function buildDeparture(date: string, time: string, now: Date): string | null {
  const local = new Date(`${date}T${time}`);
  if (Number.isNaN(local.getTime())) return null;
  return clampDeparture(local, now).toISOString();
}

export default function AdvancedOptions({
  value,
  onDepartureChange,
  durationMax,
  onDurationMaxChange,
}: AdvancedOptionsProps) {
  const initial = toLocalInputs(value ?? defaultDeparture());
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [duration, setDuration] = useState(durationMax == null ? "" : `${durationMax}`);
  const [durationError, setDurationError] = useState<string | undefined>();

  const onDepartureChangeRef = useRef(onDepartureChange);
  onDepartureChangeRef.current = onDepartureChange;

  useEffect(() => {
    const iso = buildDeparture(date, time, new Date());
    if (iso !== null) onDepartureChangeRef.current(iso);
  }, [date, time]);

  function commitDateAndTime(nextDate: string, nextTime: string) {
    const iso = buildDeparture(nextDate, nextTime, new Date());
    if (iso === null) return;
    const local = new Date(iso);
    setDate(toDateInput(local));
    setTime(toTimeInput(local));
  }

  function handleDuration(next: string) {
    setDuration(next);
    if (next === "") {
      setDurationError(undefined);
      onDurationMaxChange?.(null);
      return;
    }
    const parsed = Number(next);
    if (!Number.isInteger(parsed) || parsed < DURATION_MIN || parsed > DURATION_MAX) {
      setDurationError(DURATION_ERROR);
      onDurationMaxChange?.(null);
      return;
    }
    setDurationError(undefined);
    onDurationMaxChange?.(parsed);
  }

  const min = toDateInput(minDate());
  const max = toDateInput(maxDate());

  return (
    <details open className="rounded-lg border border-sand-200 bg-sand-50 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-sand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600 focus-visible:ring-offset-2">
        Opciones avanzadas
      </summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Fecha">
          <input
            type="date"
            value={date}
            min={min}
            max={max}
            onChange={(event) => commitDateAndTime(event.target.value, time)}
          />
        </Field>
        <Field label="Hora de salida">
          <input
            type="time"
            value={time}
            onChange={(event) => commitDateAndTime(date, event.target.value)}
          />
        </Field>
        <Field label="Duración máx. (min)" error={durationError} help="Opcional">
          <input
            type="number"
            inputMode="numeric"
            min={DURATION_MIN}
            max={DURATION_MAX}
            value={duration}
            placeholder="Opcional"
            onChange={(event) => handleDuration(event.target.value)}
          />
        </Field>
      </div>
    </details>
  );
}
