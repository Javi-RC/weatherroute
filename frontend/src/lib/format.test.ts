import { describe, expect, it } from "vitest";
import {
  formatClockTime,
  formatDistance,
  formatDuration,
  formatPercent,
  formatSavedAt,
  formatScore,
  formatTemperature,
  formatVisibility,
  formatWind,
} from "./format";

describe("formatDistance", () => {
  it("uses a comma decimal with exactly one digit and a km suffix", () => {
    expect(formatDistance(74.23)).toBe("74,2 km");
    expect(formatDistance(9)).toBe("9,0 km");
  });
});

describe("formatDuration", () => {
  it("renders sub-hour durations as minutes only", () => {
    expect(formatDuration(45)).toBe("45 m");
  });

  it("renders zero as 0 m", () => {
    expect(formatDuration(0)).toBe("0 m");
  });

  it("omits the minutes part on exact hours", () => {
    expect(formatDuration(120)).toBe("2 h");
  });

  it("renders hours and minutes together", () => {
    expect(formatDuration(168)).toBe("2 h 48 m");
  });

  it("rounds fractional minutes before splitting", () => {
    expect(formatDuration(45.4)).toBe("45 m");
    expect(formatDuration(119.6)).toBe("2 h");
  });
});

describe("formatPercent", () => {
  it("rounds to an integer and uses a Spanish space before %", () => {
    expect(formatPercent(45.6)).toBe("46 %");
    expect(formatPercent(0)).toBe("0 %");
  });
});

describe("formatTemperature", () => {
  it("renders integer Celsius with a degree sign", () => {
    expect(formatTemperature(22)).toBe("22 °C");
    expect(formatTemperature(-3.4)).toBe("-3 °C");
  });
});

describe("formatWind", () => {
  it("rounds to an integer km/h", () => {
    expect(formatWind(32.4)).toBe("32 km/h");
    expect(formatWind(31.6)).toBe("32 km/h");
  });
});

describe("formatVisibility", () => {
  it("rounds to an integer km", () => {
    expect(formatVisibility(9.2)).toBe("9 km");
    expect(formatVisibility(0.6)).toBe("1 km");
  });
});

describe("formatScore", () => {
  it("renders the score out of 100 as an integer", () => {
    expect(formatScore(88)).toBe("88/100");
    expect(formatScore(88.2)).toBe("88/100");
  });
});

describe("formatClockTime", () => {
  // UTC→local contract: given a UTC instant, return the clock time in the
  // process-local zone. We assert against the local wall-clock rendering of
  // the same instant (getHours/getMinutes return local values), so the test
  // is deterministic regardless of the machine's timezone.
  it("renders the local hour/minute of a UTC instant", () => {
    const instant = new Date(Date.UTC(2026, 8, 22, 16, 0));
    expect(formatClockTime(instant)).toBe(localClock(instant));
  });

  it("accepts an ISO string and keeps minutes across zone shifts", () => {
    const instant = new Date(Date.UTC(2026, 8, 22, 23, 5));
    expect(formatClockTime(instant.toISOString())).toBe(localClock(instant));
  });
});

function localClock(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

describe("formatSavedAt", () => {
  const now = new Date(2026, 8, 22, 12, 0, 0);

  it("renders relative moments in Spanish", () => {
    expect(formatSavedAt(new Date(now.getTime() - 5_000), now)).toBe("Ahora");
    expect(
      formatSavedAt(new Date(now.getTime() - 60_000), now),
    ).toBe("Hace 1 min");
    expect(
      formatSavedAt(new Date(now.getTime() - 45 * 60_000), now),
    ).toBe("Hace 45 min");
    expect(
      formatSavedAt(new Date(now.getTime() - 2 * 3_600_000), now),
    ).toBe("Hace 2 h");
  });

  it("falls back to a Spanish date past 24 h and clamps clock skew", () => {
    const old = new Date(now.getTime() - 26 * 3_600_000);
    expect(formatSavedAt(old, now)).toBe(old.toLocaleDateString("es-ES"));
    expect(formatSavedAt(new Date(now.getTime() + 3_600_000), now)).toBe(
      "Ahora",
    );
  });
});