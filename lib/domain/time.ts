// Times are stored in UTC and shown in the airport's local time (IANA zone, e.g. Europe/Sofia).
// These helpers convert between the two without a date library.

const pad = (n: number) => String(n).padStart(2, "0");

/** Minutes the zone is ahead of UTC at that instant (e.g. 180 for Sofia in summer). */
export function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** "2026-10-01T08:00" or "2026-10-01" as a valid local time/day, else null. */
function parseLocal(local: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h = "0", mi = "0"] = m.slice(1).map((v) => v ?? "0");
  const parts = [y, mo, d, h, mi].map(Number) as [number, number, number, number, number];
  const utc = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4]));
  // Reject overflow like 2026-02-30 or 25:00.
  if (utc.getUTCMonth() !== parts[1] - 1 || utc.getUTCDate() !== parts[2] || parts[3] > 23) {
    return null;
  }
  return utc.getTime();
}

/**
 * Local wall time in a zone ("2026-10-01T08:00") → the UTC instant. Times that don't exist
 * (skipped by a daylight-saving change) move forward, like clocks do. Null if invalid.
 */
export function zonedToUtc(local: string, timeZone: string): Date | null {
  const wall = parseLocal(local);
  if (wall === null) return null;
  const first = wall - zoneOffsetMinutes(new Date(wall), timeZone) * 60_000;
  const second = wall - zoneOffsetMinutes(new Date(first), timeZone) * 60_000;
  return new Date(Math.max(first, second));
}

/** The UTC instant as local wall time in a zone: "2026-10-01T11:00". */
export function utcToZoned(instant: Date, timeZone: string): string {
  const shifted = new Date(instant.getTime() + zoneOffsetMinutes(instant, timeZone) * 60_000);
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
  );
}

/** The local calendar day of an instant in a zone: "2026-10-01". */
export function zonedDay(instant: Date, timeZone: string): string {
  return utcToZoned(instant, timeZone).slice(0, 10);
}

/** "2026-10" → the days of that month, "2026-10-01" … "2026-10-31". */
export function daysOfMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`);
}

/** "2026-10" ± n months. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** "2026-10-01" + n days. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Postgres range literal for [from, to), e.g. for tstzrange columns. */
export function toRange(from: Date, to: Date): string {
  return `[${from.toISOString()},${to.toISOString()})`;
}

/** Local calendar days an instant range [from, to) touches in a zone (at least 1). */
export function localDaysTouched(from: Date, to: Date, timeZone: string): number {
  const first = zonedDay(from, timeZone);
  const last = zonedDay(new Date(Math.max(to.getTime() - 1, from.getTime())), timeZone);
  let days = 1;
  for (let d = first; d < last; d = addDays(d, 1)) days++;
  return days;
}

/** Whether an instant falls on a Saturday or Sunday in a zone. */
export function isWeekend(instant: Date, timeZone: string): boolean {
  const day = new Date(`${zonedDay(instant, timeZone)}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}
