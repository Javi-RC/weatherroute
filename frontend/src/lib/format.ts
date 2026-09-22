const digits = (n: number) =>
  new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: n,
    maximumFractionDigits: n,
  });

export function formatDistance(km: number): string {
  return `${digits(1).format(km)} km`;
}

export function formatDuration(min: number): string {
  const total = Math.round(min);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours > 0) return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} m`;
  return `${minutes} m`;
}

export function formatPercent(n: number): string {
  return `${digits(0).format(n)} %`;
}

export function formatTemperature(c: number): string {
  return `${digits(0).format(c)} °C`;
}

export function formatWind(kmh: number): string {
  return `${digits(0).format(kmh)} km/h`;
}

export function formatVisibility(km: number): string {
  return `${digits(0).format(km)} km`;
}

export function formatScore(score: number): string {
  return `${Math.round(score)}/100`;
}

/** UTC→local contract: given a UTC instant, returns the local clock hour. */
export function formatClockTime(date: Date | string): string {
  const instant = typeof date === "string" ? new Date(date) : date;
  return instant.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatSavedAt(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 60_000) return "Ahora";
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  return date.toLocaleDateString("es-ES");
}