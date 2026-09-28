// Month calendar maths in UTC days (aviation runs on UTC): which entries touch each day and how
// much of the day they cover.
import { addDays, daysOfMonth } from "./time";

export type Span = { from: Date; to: Date };

/** How much of [start, end) the spans cover, 0…1 (overlaps counted once). */
export function coverage(spans: Span[], start: number, end: number): number {
  const parts = spans
    .map((s) => [Math.max(s.from.getTime(), start), Math.min(s.to.getTime(), end)] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let covered = 0;
  let until = start;
  for (const [a, b] of parts) {
    if (b <= until) continue;
    covered += b - Math.max(a, until);
    until = b;
  }
  return covered / (end - start);
}

export type DayState = "free" | "partly" | "busy";

/** The days of a month (YYYY-MM) with the spans touching each and how busy it is. */
export function monthDays<T extends Span>(month: string, spans: T[]) {
  return daysOfMonth(month).map((day) => {
    const start = Date.parse(`${day}T00:00:00Z`);
    const end = Date.parse(`${addDays(day, 1)}T00:00:00Z`);
    const inDay = spans.filter((s) => s.from.getTime() < end && s.to.getTime() > start);
    const share = coverage(inDay, start, end);
    const state: DayState = share >= 0.999 ? "busy" : share > 0 ? "partly" : "free";
    return { day, state, spans: inDay };
  });
}
