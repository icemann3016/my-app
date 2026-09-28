import { describe, expect, it } from "vitest";

import { coverage, monthDays } from "./calendar";

const at = (iso: string) => new Date(iso);

describe("calendar days (UTC)", () => {
  it("counts overlapping spans once", () => {
    const day = [Date.parse("2026-10-05T00:00:00Z"), Date.parse("2026-10-06T00:00:00Z")] as const;
    const spans = [
      { from: at("2026-10-05T06:00:00Z"), to: at("2026-10-05T12:00:00Z") },
      { from: at("2026-10-05T10:00:00Z"), to: at("2026-10-05T18:00:00Z") },
    ];
    expect(coverage(spans, ...day)).toBeCloseTo(0.5);
  });

  it("marks days free, partly or fully busy, in UTC", () => {
    const days = monthDays("2026-10", [
      { from: at("2026-10-05T08:00:00Z"), to: at("2026-10-05T12:00:00Z") },
      { from: at("2026-10-07T22:00:00Z"), to: at("2026-10-09T02:00:00Z") },
    ]);
    const state = (d: string) => days.find((x) => x.day === d)!.state;
    expect(days).toHaveLength(31);
    expect(state("2026-10-04")).toBe("free");
    expect(state("2026-10-05")).toBe("partly");
    expect(state("2026-10-07")).toBe("partly");
    expect(state("2026-10-08")).toBe("busy");
    expect(state("2026-10-09")).toBe("partly");
    expect(days.find((x) => x.day === "2026-10-08")!.spans).toHaveLength(1);
  });
});
