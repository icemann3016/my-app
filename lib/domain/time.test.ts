import { describe, expect, it } from "vitest";

import { addDays, addMonths, daysOfMonth, utcToZoned, zonedDay, zonedToUtc } from "./time";

describe("zoned time", () => {
  it("converts Sofia local time to UTC in summer and winter", () => {
    expect(zonedToUtc("2026-07-01T08:00", "Europe/Sofia")?.toISOString()).toBe(
      "2026-07-01T05:00:00.000Z",
    );
    expect(zonedToUtc("2026-12-01T08:00", "Europe/Sofia")?.toISOString()).toBe(
      "2026-12-01T06:00:00.000Z",
    );
    expect(zonedToUtc("2026-12-01", "Europe/Sofia")?.toISOString()).toBe(
      "2026-11-30T22:00:00.000Z",
    );
  });

  it("moves times skipped by daylight saving forward", () => {
    // Clocks jump from 03:00 to 04:00 in Sofia on 29 March 2026.
    expect(zonedToUtc("2026-03-29T03:30", "Europe/Sofia")?.toISOString()).toBe(
      "2026-03-29T01:30:00.000Z",
    );
  });

  it("rejects invalid input", () => {
    expect(zonedToUtc("2026-02-30T10:00", "Europe/Sofia")).toBeNull();
    expect(zonedToUtc("2026-10-01T25:00", "Europe/Sofia")).toBeNull();
    expect(zonedToUtc("tomorrow", "Europe/Sofia")).toBeNull();
  });

  it("shows UTC instants in local time", () => {
    const instant = new Date("2026-10-01T21:30:00Z");
    expect(utcToZoned(instant, "Europe/Sofia")).toBe("2026-10-02T00:30");
    expect(zonedDay(instant, "Europe/Sofia")).toBe("2026-10-02");
    expect(utcToZoned(instant, "UTC")).toBe("2026-10-01T21:30");
  });
});

describe("calendar days", () => {
  it("lists the days of a month and moves between months", () => {
    expect(daysOfMonth("2028-02")).toHaveLength(29);
    expect(daysOfMonth("2026-10")[30]).toBe("2026-10-31");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
