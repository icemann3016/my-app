import "server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { adminActions, profiles, userRoles } from "@/lib/db/schema";
import type { ModerationResult } from "./moderation";

/**
 * Give or take away the admin role (ADM-2), logged as grant_admin / revoke_admin. Trusted admin
 * code after requireAdmin(). You can't remove your own role (so there's always at least one
 * admin, and nobody locks themselves out by mistake), and suspended members can't become admins.
 */
export async function setAdminRole(
  adminId: string,
  userId: string,
  grant: boolean,
  reason: string | null,
): Promise<ModerationResult> {
  if (!grant && adminId === userId) return { ok: false, error: "self" };
  return getDb().transaction(async (tx) => {
    const [member] = await tx
      .select({ suspendedAt: profiles.suspendedAt })
      .from(profiles)
      .where(eq(profiles.id, userId));
    if (!member) return { ok: false, error: "notFound" } as const;
    if (grant && member.suspendedAt) return { ok: false, error: "suspendedAccount" } as const;
    const changed = grant
      ? await tx
          .insert(userRoles)
          .values({ userId, role: "admin" })
          .onConflictDoNothing()
          .returning({ userId: userRoles.userId })
      : await tx
          .delete(userRoles)
          .where(and(eq(userRoles.userId, userId), eq(userRoles.role, "admin")))
          .returning({ userId: userRoles.userId });
    if (!changed.length) return { ok: false, error: "notFound" } as const;
    await tx.insert(adminActions).values({
      adminId,
      action: grant ? "grant_admin" : "revoke_admin",
      targetType: "user",
      targetId: userId,
      reason,
    });
    return { ok: true } as const;
  });
}
