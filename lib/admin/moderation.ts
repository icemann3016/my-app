import "server-only";

import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { adminActions, aircraft, profiles, reports, reviews, sessions } from "@/lib/db/schema";

// Moderation actions (ADM-2). Trusted admin code: callers must have checked the admin role with
// requireAdmin(). Every action is written to admin_actions (the audit log) in the same
// transaction.

export type ModerationResult = { ok: true } | { ok: false; error: "notFound" | "self" };

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

function log(
  tx: Tx,
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  reason: string | null,
) {
  return tx.insert(adminActions).values({ adminId, action, targetType, targetId, reason });
}

/**
 * Suspend a user: they can't log in (sessions deleted, new ones refused), message, review or
 * book, and their listed aircraft are unlisted until an admin allows listing again.
 */
export async function suspendUser(
  adminId: string,
  userId: string,
  reason: string | null,
): Promise<ModerationResult> {
  if (adminId === userId) return { ok: false, error: "self" };
  return getDb().transaction(async (tx) => {
    const done = await tx
      .update(profiles)
      .set({ suspendedAt: new Date() })
      .where(and(eq(profiles.id, userId), isNull(profiles.suspendedAt)))
      .returning({ id: profiles.id });
    if (!done.length) return { ok: false, error: "notFound" } as const;
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx
      .update(aircraft)
      .set({ status: "unlisted", unlistedReason: "suspended" })
      .where(and(eq(aircraft.ownerId, userId), eq(aircraft.status, "listed")));
    await log(tx, adminId, "suspend_user", "user", userId, reason);
    return { ok: true } as const;
  });
}

/** Lift a suspension. Aircraft unlisted by it may be listed again by the owner. */
export async function unsuspendUser(
  adminId: string,
  userId: string,
  reason: string | null,
): Promise<ModerationResult> {
  return getDb().transaction(async (tx) => {
    const done = await tx
      .update(profiles)
      .set({ suspendedAt: null })
      .where(and(eq(profiles.id, userId), isNotNull(profiles.suspendedAt)))
      .returning({ id: profiles.id });
    if (!done.length) return { ok: false, error: "notFound" } as const;
    await tx
      .update(aircraft)
      .set({ unlistedReason: null })
      .where(and(eq(aircraft.ownerId, userId), eq(aircraft.unlistedReason, "suspended")));
    await log(tx, adminId, "unsuspend_user", "user", userId, reason);
    return { ok: true } as const;
  });
}

/** Unlist an aircraft that breaks the rules; the owner can't list it again until allowed. */
export async function unlistAircraft(
  adminId: string,
  aircraftId: string,
  reason: string | null,
): Promise<ModerationResult> {
  return getDb().transaction(async (tx) => {
    const done = await tx
      .update(aircraft)
      .set({ status: "unlisted", unlistedReason: "admin" })
      .where(
        and(
          eq(aircraft.id, aircraftId),
          inArray(aircraft.status, ["listed", "paused", "unlisted"]),
        ),
      )
      .returning({ id: aircraft.id });
    if (!done.length) return { ok: false, error: "notFound" } as const;
    await log(tx, adminId, "unlist_aircraft", "aircraft", aircraftId, reason);
    return { ok: true } as const;
  });
}

/** Let the owner list an aircraft again (it stays unlisted until they do). */
export async function allowListing(
  adminId: string,
  aircraftId: string,
  reason: string | null,
): Promise<ModerationResult> {
  return getDb().transaction(async (tx) => {
    const done = await tx
      .update(aircraft)
      .set({ unlistedReason: null })
      .where(
        and(eq(aircraft.id, aircraftId), inArray(aircraft.unlistedReason, ["admin", "suspended"])),
      )
      .returning({ id: aircraft.id });
    if (!done.length) return { ok: false, error: "notFound" } as const;
    await log(tx, adminId, "allow_listing", "aircraft", aircraftId, reason);
    return { ok: true } as const;
  });
}

/** Hide a review that breaks the rules (RAT-5), or show it again. Averages follow by trigger. */
export async function setReviewHidden(
  adminId: string,
  reviewId: string,
  hidden: boolean,
  reason: string | null,
): Promise<ModerationResult> {
  return getDb().transaction(async (tx) => {
    const done = await tx
      .update(reviews)
      .set(
        hidden
          ? { hiddenAt: new Date(), hiddenBy: adminId, hiddenReason: reason }
          : { hiddenAt: null, hiddenBy: null, hiddenReason: null },
      )
      .where(
        and(
          eq(reviews.id, reviewId),
          hidden ? isNull(reviews.hiddenAt) : isNotNull(reviews.hiddenAt),
        ),
      )
      .returning({ id: reviews.id });
    if (!done.length) return { ok: false, error: "notFound" } as const;
    await log(tx, adminId, hidden ? "hide_review" : "show_review", "review", reviewId, reason);
    return { ok: true } as const;
  });
}

/** Close a report as resolved (action taken) or dismissed (nothing wrong) (ADM-3). */
export async function closeReport(
  adminId: string,
  reportId: string,
  status: "resolved" | "dismissed",
  note: string | null,
): Promise<ModerationResult> {
  return getDb().transaction(async (tx) => {
    const done = await tx
      .update(reports)
      .set({ status, resolvedAt: new Date(), resolvedBy: adminId, resolution: note })
      .where(and(eq(reports.id, reportId), eq(reports.status, "open")))
      .returning({ id: reports.id });
    if (!done.length) return { ok: false, error: "notFound" } as const;
    await log(tx, adminId, `report_${status}`, "report", reportId, note);
    return { ok: true } as const;
  });
}
