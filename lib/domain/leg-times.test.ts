import { describe, expect, it } from "vitest";

import { legTimesToUtc } from "./leg-times";

const iso = (d: Date | null | undefined) => d?.toISOString().slice(0, 16);

describe("leg times", () => {
  it("converts local clock times to UTC", () => {
    const t = legTimesToUtc({
      date: "2026-10-01",
      fromZone: "Europe/Sofia",
      toZone: "Europe/Sofia",
      blockOff: "10:05",
      engineStart: "10:10",
      takeoff: "10:20",
      landing: "11:30",
      engineStop: "11:35",
      blockOn: "11:40",
    })!;
    expect(iso(t.blockOff)).toBe("2026-10-01T07:05");
    expect(iso(t.takeoffAt)).toBe("2026-10-01T07:20");
    expect(iso(t.blockOn)).toBe("2026-10-01T08:40");
  });

  it("uses the arrival airfield's zone for arrival times", () => {
    // Sofia (UTC+3 in summer) to Belgrade (UTC+2): lands at 10:50 local = 08:50 UTC.
    const t = legTimesToUtc({
      date: "2026-07-01",
      fromZone: "Europe/Sofia",
      toZone: "Europe/Belgrade",
      blockOff: "10:00",
      engineStart: "10:05",
      engineStop: "10:55",
      blockOn: "11:00",
    })!;
    expect(iso(t.engineStart)).toBe("2026-07-01T07:05");
    expect(iso(t.engineStop)).toBe("2026-07-01T08:55");
    expect(t.takeoffAt).toBeNull();
  });

  it("rolls over midnight", () => {
    const t = legTimesToUtc({
      date: "2026-10-01",
      fromZone: "UTC",
      toZone: "UTC",
      blockOff: "23:30",
      engineStart: "23:40",
      engineStop: "00:30",
      blockOn: "00:35",
    })!;
    expect(iso(t.blockOn)).toBe("2026-10-02T00:35");
  });

  it("rejects missing or badly written times", () => {
    const base = {
      date: "2026-10-01",
      fromZone: "UTC",
      toZone: "UTC",
      blockOff: "10:00",
      engineStart: "10:05",
      engineStop: "11:00",
    };
    expect(legTimesToUtc({ ...base, blockOn: "" })).toBeNull();
    expect(legTimesToUtc({ ...base, blockOn: "25:00" })).toBeNull();
  });
});
