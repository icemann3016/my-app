import { getAirport } from "@/lib/airports";
import { zonedToUtc } from "@/lib/domain/time";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * The month to show and the period a pilot searched for, from the URL. Search times are local
 * to the searched airfield (the home base if none was given).
 */
export async function wantedPeriod(
  query: Record<string, string | string[] | undefined>,
  homeTimeZone: string,
): Promise<{ month: string | null; period: { from: Date; to: Date } | null }> {
  const monthParam = one(query.month);
  const month = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : null;
  const fromParam = one(query.from);
  const toParam = one(query.to);
  if (!fromParam || !toParam) return { month, period: null };
  const searched = one(query.airport);
  const zone = (searched ? (await getAirport(searched))?.timezone : null) ?? homeTimeZone;
  const from = zonedToUtc(fromParam, zone);
  const to = zonedToUtc(toParam, zone);
  return { month, period: from && to && to > from ? { from, to } : null };
}
