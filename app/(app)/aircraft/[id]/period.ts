import { zonedToUtc } from "@/lib/domain/time";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * The month to show and the period a pilot searched for, from the URL. Search times are UTC.
 */
export async function wantedPeriod(
  query: Record<string, string | string[] | undefined>,
): Promise<{ month: string | null; period: { from: Date; to: Date } | null }> {
  const monthParam = one(query.month);
  const month = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : null;
  const fromParam = one(query.from);
  const toParam = one(query.to);
  if (!fromParam || !toParam) return { month, period: null };
  // All times are UTC (aviation convention).
  const from = zonedToUtc(fromParam, "UTC");
  const to = zonedToUtc(toParam, "UTC");
  return { month, period: from && to && to > from ? { from, to } : null };
}
