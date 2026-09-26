import type { CredentialKind, CredentialRef } from "./labels";
import { expiryState, isUsable, todayUtc } from "./validity";

export type CredentialItem = {
  id: string;
  kind: CredentialKind;
  status: "pending" | "verified" | "rejected";
  /** Expiry date (medical: valid until), YYYY-MM-DD, or null. */
  expiresOn: string | null;
  /** What it is, for credentialLabel(). */
  ref?: CredentialRef;
};

export type PilotSummary = {
  /** Has a verified, unexpired licence and medical: may rent aircraft. */
  verified: boolean;
  pending: number;
  rejected: number;
  expiring: CredentialItem[];
  expired: CredentialItem[];
  missing: ("licence" | "medical")[];
};

export function pilotSummary(items: CredentialItem[], today = todayUtc()): PilotSummary {
  const usable = (kind: CredentialKind) => items.some((i) => i.kind === kind && isUsable(i, today));
  const missing = (["licence", "medical"] as const).filter((k) => !usable(k));
  const active = items.filter((i) => i.status !== "rejected");
  return {
    verified: missing.length === 0,
    pending: items.filter((i) => i.status === "pending").length,
    rejected: items.filter((i) => i.status === "rejected").length,
    expiring: active.filter((i) => expiryState(i.expiresOn, today) === "expiring"),
    expired: active.filter((i) => expiryState(i.expiresOn, today) === "expired"),
    missing,
  };
}
