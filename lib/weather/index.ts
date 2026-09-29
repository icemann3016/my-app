import "server-only";

import {
  belowVfr,
  type Conditions,
  parseMetar,
  parseTaf,
  type TafPeriod,
  tafWarnings,
} from "./parse";

// Weather warnings for bookings (decision 2026-09-27): METAR and TAF from aviationweather.gov
// (NOAA, free, no key) for every airfield of the flight. Airfields without reports use the
// nearest reporting station within 50 km. Warnings only: the pilot in command decides.

const API = process.env.WEATHER_API_URL ?? "https://aviationweather.gov/api/data";
/** TAFs are shown from this many hours before departure (their range is ~24–30 h). */
export const TAF_HOURS = 30;
/** METARs are shown from this many hours before departure, and during the flight. */
export const METAR_HOURS = 3;
const NEAREST_KM = 50;

export type Airfield = {
  ident: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
};

type Report = { icaoId?: string; lat?: number; lon?: number; rawOb?: string; rawTAF?: string };
export type Fetcher = (path: string) => Promise<Report[] | null>;

/** GET a JSON list from the weather API, cached for 10 minutes; null when it failed. */
export const fetchReports: Fetcher = async (path) => {
  try {
    const response = await fetch(`${API}/${path}`, {
      headers: { "user-agent": "ownaplane.eu (flight booking weather warnings)" },
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 204) return [];
    if (!response.ok) return null;
    const data = (await response.json()) as unknown;
    return Array.isArray(data) ? (data as Report[]) : [];
  } catch {
    return null;
  }
};

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

type Found = { station: string; distanceKm: number | null; raw: string };

/** The airfield's own report, else the nearest one within 50 km; null if none; "error". */
async function findReport(
  kind: "metar" | "taf",
  field: Airfield,
  get: Fetcher,
): Promise<Found | null | "error"> {
  const rawOf = (r: Report) => (kind === "metar" ? r.rawOb : r.rawTAF)?.trim();
  if (/^[A-Z]{4}$/.test(field.code)) {
    const own = await get(`${kind}?ids=${field.code}&format=json`);
    if (own === null) return "error";
    const report = own.find((r) => r.icaoId === field.code && rawOf(r));
    if (report) return { station: field.code, distanceKm: null, raw: rawOf(report)! };
  }
  const dLat = 0.5;
  const dLon = 0.5 / Math.max(0.2, Math.cos((field.latitude * Math.PI) / 180));
  const box = [
    field.latitude - dLat,
    field.longitude - dLon,
    field.latitude + dLat,
    field.longitude + dLon,
  ]
    .map((n) => n.toFixed(3))
    .join(",");
  const around = await get(`${kind}?bbox=${box}&format=json`);
  if (around === null) return "error";
  const nearest = around
    .filter((r) => r.icaoId && rawOf(r) && typeof r.lat === "number" && typeof r.lon === "number")
    .map((r) => ({ r, km: distanceKm(field.latitude, field.longitude, r.lat!, r.lon!) }))
    .filter((x) => x.km <= NEAREST_KM)
    .sort((a, b) => a.km - b.km)[0];
  return nearest
    ? { station: nearest.r.icaoId!, distanceKm: Math.round(nearest.km), raw: rawOf(nearest.r)! }
    : null;
}

/** When a report was issued, from its ddhhmmZ group (in the month around `now`). */
export function reportTime(raw: string, now: Date): Date | null {
  const m = raw.match(/\b(\d{2})(\d{2})(\d{2})Z\b/);
  if (!m) return null;
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Number(m[1]), Number(m[2]), Number(m[3])),
  );
  if (d.getTime() > now.getTime() + 2 * 86_400_000) d.setUTCMonth(d.getUTCMonth() - 1);
  return d;
}

export type FieldWeather = {
  field: Airfield;
  metar?: (Found & { time: Date | null; conditions: Conditions; below: boolean }) | null;
  taf?: (Found & { issued: Date | null; warnings: TafPeriod[] }) | null;
};

export type BookingWeather =
  | { stage: "past" }
  | { stage: "later"; showsAt: Date }
  | { stage: "now"; fields: FieldWeather[]; below: boolean; unavailable: boolean };

/**
 * Weather for a booking's airfields: TAF warnings for the booked time from 30 h before
 * departure, and the latest METAR from 3 h before departure until the booking ends.
 */
export async function bookingWeather(
  route: Airfield[],
  period: { from: Date; to: Date },
  now = new Date(),
  get: Fetcher = fetchReports,
): Promise<BookingWeather> {
  if (period.to <= now) return { stage: "past" };
  const hours = (period.from.getTime() - now.getTime()) / 3_600_000;
  if (hours > TAF_HOURS) {
    return { stage: "later", showsAt: new Date(period.from.getTime() - TAF_HOURS * 3_600_000) };
  }
  const window = { from: period.from > now ? period.from : now, to: period.to };
  const unique = [...new Map(route.map((f) => [f.ident, f])).values()];
  let unavailable = false;
  const fields = await Promise.all(
    unique.map(async (field): Promise<FieldWeather> => {
      const [taf, metar] = await Promise.all([
        findReport("taf", field, get),
        hours <= METAR_HOURS ? findReport("metar", field, get) : Promise.resolve(undefined),
      ]);
      if (taf === "error" || metar === "error") unavailable = true;
      const result: FieldWeather = { field };
      if (taf && taf !== "error") {
        const issued = reportTime(taf.raw, now);
        const periods = issued ? parseTaf(taf.raw, issued) : [];
        result.taf = { ...taf, issued, warnings: tafWarnings(periods, window.from, window.to) };
      } else if (taf === null) result.taf = null;
      if (metar && metar !== "error") {
        const conditions = parseMetar(metar.raw);
        result.metar = {
          ...metar,
          time: reportTime(metar.raw, now),
          conditions,
          below: belowVfr(conditions),
        };
      } else if (metar === null) result.metar = null;
      return result;
    }),
  );
  const below = fields.some((f) => f.metar?.below || (f.taf?.warnings.length ?? 0) > 0);
  return { stage: "now", fields, below, unavailable };
}
