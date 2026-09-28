import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { asUser } from "@/lib/db/rls";
import { adminActions, medicals, pilotLicences, pilotRatings, profiles } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { getRecipient } from "@/lib/email/recipient";
import { credentialReviewedEmail } from "@/lib/email/templates";
import type { CredentialKind, CredentialRef } from "@/lib/pilot/labels";
import { appUrl } from "@/lib/site-url";

export type QueueEntry = {
  userId: string;
  displayName: string;
  items: number;
  since: Date;
};

/** Pilots with credentials waiting for review, oldest first. Read as the admin (RLS). */
export async function getVerificationQueue(adminId: string): Promise<QueueEntry[]> {
  const rows = (await asUser(adminId, (tx) =>
    tx.execute(sql`
      select p.user_id, pr.display_name, count(*)::int as items, min(p.updated_at) as since
      from (
        select user_id, updated_at from ${pilotLicences} where status = 'pending'
        union all
        select user_id, updated_at from ${pilotRatings} where status = 'pending'
        union all
        select user_id, updated_at from ${medicals} where status = 'pending'
      ) p
      join ${profiles} pr on pr.id = p.user_id
      group by p.user_id, pr.display_name
      order by since asc
      limit 200
    `),
  )) as unknown as { user_id: string; display_name: string; items: number; since: string }[];
  return rows.map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    items: r.items,
    since: new Date(r.since),
  }));
}

/** Admin actions about a pilot's credentials and documents, newest first. */
export async function getReviewHistory(adminId: string, targetIds: string[]) {
  if (!targetIds.length) return [];
  return asUser(adminId, (tx) =>
    tx
      .select({
        id: adminActions.id,
        action: adminActions.action,
        targetType: adminActions.targetType,
        targetId: adminActions.targetId,
        reason: adminActions.reason,
        createdAt: adminActions.createdAt,
        adminName: profiles.displayName,
      })
      .from(adminActions)
      .leftJoin(profiles, eq(profiles.id, adminActions.adminId))
      .where(inArray(adminActions.targetId, targetIds))
      .orderBy(desc(adminActions.createdAt))
      .limit(50),
  );
}

const tables = { licence: pilotLicences, rating: pilotRatings, medical: medicals } as const;

export type ReviewResult =
  { ok: true; pilotId: string } | { ok: false; error: "notFound" | "ownItem" | "changed" };

/**
 * Verify or reject one credential. Trusted admin code: the caller must have checked the admin
 * role (requireAdmin). Uses the owner connection because users can't change review columns.
 * `version` is the item's updated_at the admin saw, so a pilot's edit in the meantime isn't
 * verified by accident.
 */
export async function reviewCredential({
  adminId,
  kind,
  id,
  version,
  decision,
  reason,
}: {
  adminId: string;
  kind: CredentialKind;
  id: string;
  version: string;
  decision: "verify" | "reject";
  reason: string | null;
}): Promise<ReviewResult> {
  const table = tables[kind] as typeof pilotLicences; // shared review columns
  const db = getDb();
  const [row] = await db.select().from(table).where(eq(table.id, id));
  if (!row) return { ok: false, error: "notFound" };
  if (row.userId === adminId) return { ok: false, error: "ownItem" };

  const updated = await db.transaction(async (tx) => {
    const done = await tx
      .update(table)
      .set({
        status: decision === "verify" ? "verified" : "rejected",
        rejectionReason: decision === "reject" ? reason : null,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      })
      .where(
        and(
          eq(table.id, id),
          sql`date_trunc('milliseconds', ${table.updatedAt}) = ${version}::timestamptz`,
        ),
      )
      .returning({ id: table.id });
    if (!done.length) return false;
    await tx.insert(adminActions).values({
      adminId,
      action: `credential.${decision}`,
      targetType: kind,
      targetId: id,
      reason: decision === "reject" ? reason : null,
    });
    return true;
  });
  if (!updated) return { ok: false, error: "changed" };

  await notifyPilot(
    row.userId,
    refOf(kind, row as unknown as Record<string, string>),
    decision,
    reason,
  );
  return { ok: true, pilotId: row.userId };
}

function refOf(kind: CredentialKind, row: Record<string, string>): CredentialRef {
  if (kind === "licence") return { kind, type: row.type! };
  if (kind === "medical") return { kind, class: row.class! };
  return { kind, ratingKind: row.kind!, code: row.code! };
}

async function notifyPilot(
  pilotId: string,
  item: CredentialRef,
  decision: "verify" | "reject",
  reason: string | null,
) {
  try {
    const to = await getRecipient(pilotId);
    if (!to) return;
    await sendEmail({
      to: to.email,
      ...credentialReviewedEmail({
        name: to.name,
        locale: to.locale,
        item,
        decision,
        reason,
        url: `${appUrl()}/account/credentials`,
      }),
    });
  } catch (e) {
    // The decision is saved either way; the pilot also sees it on their page.
    console.error("[admin] couldn't email the pilot", e);
  }
}
