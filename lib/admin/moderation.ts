import "server-only";

import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { deleteUserFiles } from "@/lib/account/delete-files";
import {
  adminActions,
  aircraft,
  bookings,
  profiles,
  reports,
  reviews,
  sessions,
  userRoles,
  users,
} from "@/lib/db/schema";

// Moderation actions (ADM-2). Trusted admin code: callers must have checked the admin role with
// requireAdmin(). Every action is written to admin_actions (the audit log) in the same
// transaction.

export type ModerationResult =
  { ok: true } | { ok: false; error: "notFound" | "self" | "adminAccount" | "activeBookings" };

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

/**
 * Delete a member for good (e.g. on request, or a spam account). Same as when members delete
 * themselves: files first, then the account. Their aircraft go with its bookings; bookings they
 * made as a pilot, reviews and messages stay for the other side as "former member". Refused
 * while they have open bookings (requested, accepted or in progress) on either side, so nobody
 * loses a flight without notice: suspend them meanwhile. Admin accounts must lose the admin
 * role first (npm run admin:grant -- --revoke), so one admin can't remove another.
 */
export async function deleteMember(
  adminId: string,
  userId: string,
  reason: string | null,
): Promise<ModerationResult> {
  if (adminId === userId) return { ok: false, error: "self" };
  const db = getDb();
  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
  if (!target) return { ok: false, error: "notFound" };
  const [isAdmin] = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, "admin")));
  if (isAdmin) return { ok: false, error: "adminAccount" };
  const [open] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        or(eq(bookings.ownerId, userId), eq(bookings.pilotId, userId)),
        inArray(bookings.status, ["requested", "accepted", "in_progress"]),
      ),
    )
    .limit(1);
  if (open) return { ok: false, error: "activeBookings" };
  await deleteUserFiles(userId);
  return db.transaction(async (tx) => {
    await log(tx, adminId, "delete_user", "user", userId, reason);
    const done = await tx.delete(users).where(eq(users.id, userId)).returning({ id: users.id });
    if (!done.length) throw new Error("member already deleted");
    return { ok: true } as const;
  });
}
