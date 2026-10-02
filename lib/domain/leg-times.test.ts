import { describe, expect, it } from "vitest";

import { type LegClock, legTimeIssues, legTimesToUtc } from "./leg-times";

const iso = (d: Date | null | undefined) => d?.toISOString().slice(0, 16);

const utcLeg = (times: Partial<LegClock>): LegClock => ({
  date: "2026-10-01",
  fromZone: "UTC",
  toZone: "UTC",
  engineStart: "10:00",
  blockOff: "10:05",
  takeoff: "10:15",
  landing: "11:10",
  blockOn: "11:15",
  engineStop: "11:16",
  ...times,
});
const issues = (times: Partial<LegClock>) => legTimeIssues(legTimesToUtc(utcLeg(times))!);

describe("leg times", () => {
  it("converts local clock times to UTC", () => {
    const t = legTimesToUtc({
      date: "2026-10-01",
      fromZone: "Europe/Sofia",
      toZone: "Europe/Sofia",
      engineStart: "10:05",
      blockOff: "10:10",
      takeoff: "10:20",
      landing: "11:30",
      blockOn: "11:35",
      engineStop: "11:40",
    })!;
    expect(iso(t.engineStart)).toBe("2026-10-01T07:05");
    expect(iso(t.takeoffAt)).toBe("2026-10-01T07:20");
    expect(iso(t.engineStop)).toBe("2026-10-01T08:40");
  });

  it("uses the arrival airfield's zone for arrival times", () => {
    // Sofia (UTC+3 in summer) to Belgrade (UTC+2): stops at 10:55 local = 08:55 UTC.
    const t = legTimesToUtc({
      date: "2026-07-01",
      fromZone: "Europe/Sofia",
      toZone: "Europe/Belgrade",
      engineStart: "10:00",
      blockOff: "10:05",
      blockOn: "10:50",
      engineStop: "10:55",
    })!;
    expect(iso(t.blockOff)).toBe("2026-07-01T07:05");
    expect(iso(t.engineStop)).toBe("2026-07-01T08:55");
    expect(t.takeoffAt).toBeNull();
  });

  it("rolls over midnight", () => {
    const t = legTimesToUtc(
      utcLeg({ engineStart: "23:30", blockOff: "23:40", takeoff: "23:50", landing: "00:20" }),
    );
    expect(iso(t!.landingAt)).toBe("2026-10-02T00:20");
    expect(legTimeIssues(t!)).toEqual([]);
  });

  it("rejects missing or badly written times", () => {
    expect(legTimesToUtc(utcLeg({ engineStop: "" }))).toBeNull();
    expect(legTimesToUtc(utcLeg({ engineStop: "25:00" }))).toBeNull();
  });

  it("accepts engine start = block off and block on = engine stop", () => {
    expect(issues({ blockOff: "10:00", engineStop: "11:15" })).toEqual([]);
  });

  it("needs take-off, landing and block on strictly later than the time before", () => {
    expect(issues({ takeoff: "10:05" })).toEqual([
      { field: "takeoff", rule: "after", other: "blockOff" },
    ]);
    expect(issues({ landing: "10:15" })).toEqual([
      { field: "landing", rule: "after", other: "takeoff" },
    ]);
    expect(issues({ blockOn: "11:10" })).toEqual([
      { field: "blockOn", rule: "after", other: "landing" },
    ]);
    // Without take-off and landing times, block on must still follow block off.
    expect(issues({ takeoff: "", landing: "", blockOn: "10:05", engineStop: "10:06" })).toEqual([
      { field: "blockOn", rule: "after", other: "blockOff" },
    ]);
  });

  it("reports a time typed earlier than the one before it", () => {
    // Read as the next day, the leg would take ~24 h.
    expect(issues({ blockOff: "09:55" })).toEqual([
      { field: "blockOff", rule: "notBefore", other: "engineStart" },
    ]);
    expect(issues({ landing: "10:10" })).toEqual([
      { field: "landing", rule: "after", other: "takeoff" },
    ]);
    expect(issues({ engineStop: "11:14" })).toEqual([
      { field: "engineStop", rule: "notBefore", other: "blockOn" },
    ]);
  });
});
