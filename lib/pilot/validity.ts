/** Expiry state of a credential on a given day (dates as YYYY-MM-DD). */
export type ExpiryState = "none" | "valid" | "expiring" | "expired";

export const EXPIRY_WARNING_DAYS = 30;

/** Today's date as YYYY-MM-DD in UTC. */
export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function expiryState(expiresOn: string | null | undefined, today = todayUtc()): ExpiryState {
  if (!expiresOn) return "none";
  const days = daysBetween(today, expiresOn);
  if (days < 0) return "expired";
  if (days <= EXPIRY_WARNING_DAYS) return "expiring";
  return "valid";
}

/** A credential counts only if an admin verified it and it hasn't expired. */
export function isUsable(
  item: { status: string; expiresOn?: string | null },
  today = todayUtc(),
): boolean {
  return item.status === "verified" && expiryState(item.expiresOn, today) !== "expired";
}
