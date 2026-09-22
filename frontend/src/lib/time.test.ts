import { describe, expect, it } from "vitest";
import {
  TIME_PRESETS,
  clampDeparture,
  defaultDeparture,
  maxDate,
  minDate,
  presetDeparture,
} from "./time";

describe("TIME_PRESETS", () => {
  it("lists the three presets in spec order with Spanish labels", () => {
    expect(TIME_PRESETS.map((p) => p.id)).toEqual([
      "now",
      "today-18",
      "tomorrow-08",
    ]);
    expect(TIME_PRESETS.map((p) => p.label)).toEqual([
      "Ahora",
      "Hoy 18:00",
      "Mañana 08:00",
    ]);
  });
});

describe("presetDeparture", () => {
  it("now returns the instant itself as a UTC ISO string", () => {
    const now = new Date(2026, 8, 22, 9, 30, 15, 250);
    expect(presetDeparture("now", now)).toBe(now.toISOString());
  });

  it("today-18 before 18:00 lands today at 18:00 local", () => {
    const now = new Date(2026, 8, 22, 9, 0, 0);
    expect(presetDeparture("today-18", now)).toBe(
      new Date(2026, 8, 22, 18, 0, 0).toISOString(),
    );
  });

  it("today-18 exactly at 18:00 counts as already past and shifts to tomorrow", () => {
    const now = new Date(2026, 8, 22, 18, 0, 0);
    expect(presetDeparture("today-18", now)).toBe(
      new Date(2026, 8, 23, 18, 0, 0).toISOString(),
    );
  });

  it("today-18 after 18:00 shifts to tomorrow 18:00", () => {
    const now = new Date(2026, 8, 22, 20, 30, 0);
    expect(presetDeparture("today-18", now)).toBe(
      new Date(2026, 8, 23, 18, 0, 0).toISOString(),
    );
  });

  it("today-18 near midnight rolls over the day only", () => {
    const now = new Date(2026, 8, 22, 23, 59, 59);
    expect(presetDeparture("today-18", now)).toBe(
      new Date(2026, 8, 23, 18, 0, 0).toISOString(),
    );
  });

  it("tomorrow-08 returns tomorrow at 08:00 local", () => {
    const now = new Date(2026, 8, 22, 9, 0, 0);
    expect(presetDeparture("tomorrow-08", now)).toBe(
      new Date(2026, 8, 23, 8, 0, 0).toISOString(),
    );
  });

  it("tomorrow-08 is never before now", () => {
    for (const now of [
      new Date(2026, 8, 22, 0, 0, 0),
      new Date(2026, 8, 22, 23, 59, 59),
      new Date(2026, 11, 31, 23, 59, 59),
    ]) {
      expect(new Date(presetDeparture("tomorrow-08", now)).getTime()).toBeGreaterThanOrEqual(
        now.getTime(),
      );
    }
  });

  it("crosses the end of a month into the next for tomorrow-08", () => {
    const now = new Date(2026, 8, 30, 20, 0, 0);
    expect(presetDeparture("tomorrow-08", now)).toBe(
      new Date(2026, 9, 1, 8, 0, 0).toISOString(),
    );
    expect(presetDeparture("today-18", now)).toBe(
      new Date(2026, 9, 1, 18, 0, 0).toISOString(),
    );
  });

  it("crosses the end of a year for tomorrow-08", () => {
    const now = new Date(2026, 11, 31, 20, 0, 0);
    expect(presetDeparture("tomorrow-08", now)).toBe(
      new Date(2027, 0, 1, 8, 0, 0).toISOString(),
    );
    expect(presetDeparture("today-18", now)).toBe(
      new Date(2027, 0, 1, 18, 0, 0).toISOString(),
    );
  });
});

describe("minDate / maxDate", () => {
  it("span today to today + 7 days in local calendar terms", () => {
    const now = new Date(2026, 8, 22, 15, 0, 0);
    expect(minDate(now)).toEqual(new Date(2026, 8, 22));
    expect(maxDate(now)).toEqual(new Date(2026, 8, 29));
  });

  it("maxDate rolls over months", () => {
    const now = new Date(2026, 8, 26, 12, 0, 0);
    expect(minDate(now)).toEqual(new Date(2026, 8, 26));
    expect(maxDate(now)).toEqual(new Date(2026, 9, 3));
  });
});

describe("clampDeparture", () => {
  const now = new Date(2026, 8, 22, 15, 0, 0);

  it("clamps below the min bound to minDate", () => {
    const date = new Date(2026, 8, 15, 10, 0, 0);
    expect(clampDeparture(date, now)).toEqual(new Date(2026, 8, 22));
  });

  it("clamps above the max bound to maxDate", () => {
    const date = new Date(2026, 9, 5, 10, 0, 0);
    expect(clampDeparture(date, now)).toEqual(new Date(2026, 8, 29));
  });

  it("leaves dates inside the window unchanged", () => {
    const date = new Date(2026, 8, 24, 18, 0, 0);
    expect(clampDeparture(date, now)).toBe(date);
  });

  it("keeps the min bound itself unchanged", () => {
    const date = minDate(now);
    expect(clampDeparture(date, now)).toBe(date);
  });
});

describe("defaultDeparture", () => {
  it("returns today 08:00 local when it is still in the future", () => {
    const now = new Date(2026, 8, 22, 6, 30, 0);
    expect(defaultDeparture(now)).toBe(
      new Date(2026, 8, 22, 8, 0, 0).toISOString(),
    );
  });

  it("returns now once today 08:00 has passed", () => {
    const now = new Date(2026, 8, 22, 10, 0, 0);
    expect(defaultDeparture(now)).toBe(now.toISOString());
  });

  it("returns now exactly at the 08:00 boundary (not strictly future)", () => {
    const now = new Date(2026, 8, 22, 8, 0, 0);
    expect(defaultDeparture(now)).toBe(now.toISOString());
  });
});