import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { asUser } from "@/lib/db/rls";
import { adminActions, aircraft, aircraftDocuments, profiles } from "@/lib/db/schema";
import type { AircraftDocumentKind } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { getRecipient } from "@/lib/email/recipient";
import { aircraftDocumentReviewedEmail } from "@/lib/email/templates";
import { appUrl } from "@/lib/site-url";

export type AircraftQueueEntry = {
  aircraftId: string;
  registration: string;
  ownerName: string;
  items: number;
  since: Date;
};

/** Aircraft with documents waiting for review, oldest first. Read as the admin (RLS). */
export async function getAircraftQueue(adminId: string): Promise<AircraftQueueEntry[]> {
  const rows = await asUser(adminId, (tx) =>
    tx
      .select({
        aircraftId: aircraft.id,
        registration: aircraft.registration,
        ownerName: profiles.displayName,
        items: sql<number>`count(*)::int`,
        since: sql<string>`min(${aircraftDocuments.updatedAt})`,
      })
      .from(aircraftDocuments)
      .innerJoin(aircraft, eq(aircraft.id, aircraftDocuments.aircraftId))
      .innerJoin(profiles, eq(profiles.id, aircraft.ownerId))
      .where(eq(aircraftDocuments.status, "pending"))
      .groupBy(aircraft.id, aircraft.registration, profiles.displayName)
      .orderBy(sql`min(${aircraftDocuments.updatedAt})`)
      .limit(200),
  );
  return rows.map((r) => ({ ...r, since: new Date(r.since) }));
}

export type AircraftReviewResult =
  { ok: true; aircraftId: string } | { ok: false; error: "notFound" | "ownItem" | "changed" };

/**
 * Verify or reject an aircraft document (CofA, ARC, insurance). Trusted admin code: the caller
 * must have checked the admin role. `version` is the updated_at the admin saw.
 */
export async function reviewAircraftDocument({
  adminId,
  id,
  version,
  decision,
  reason,
}: {
  adminId: string;
  id: string;
  version: string;
  decision: "verify" | "reject";
  reason: string | null;
}): Promise<AircraftReviewResult> {
  const db = getDb();
  const [row] = await db
    .select({
      kind: aircraftDocuments.kind,
      status: aircraftDocuments.status,
      aircraftId: aircraft.id,
      registration: aircraft.registration,
      ownerId: aircraft.ownerId,
    })
    .from(aircraftDocuments)
    .innerJoin(aircraft, eq(aircraft.id, aircraftDocuments.aircraftId))
    .where(eq(aircraftDocuments.id, id));
  if (!row || row.status === null) return { ok: false, error: "notFound" };
  if (row.ownerId === adminId) return { ok: false, error: "ownItem" };

  const updated = await db.transaction(async (tx) => {
    const done = await tx
      .update(aircraftDocuments)
      .set({
        status: decision === "verify" ? "verified" : "rejected",
        rejectionReason: decision === "reject" ? reason : null,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      })
      .where(
        and(
          eq(aircraftDocuments.id, id),
          sql`date_trunc('milliseconds', ${aircraftDocuments.updatedAt}) = ${version}::timestamptz`,
        ),
      )
      .returning({ id: aircraftDocuments.id });
    if (!done.length) return false;
    await tx.insert(adminActions).values({
      adminId,
      action: `aircraft_document.${decision}`,
      targetType: "aircraft_document",
      targetId: id,
      reason: decision === "reject" ? reason : null,
    });
    return true;
  });
  if (!updated) return { ok: false, error: "changed" };

  await notifyOwner(row, decision, reason);
  return { ok: true, aircraftId: row.aircraftId };
}

async function notifyOwner(
  row: { ownerId: string; aircraftId: string; registration: string; kind: AircraftDocumentKind },
  decision: "verify" | "reject",
  reason: string | null,
) {
  try {
    const to = await getRecipient(row.ownerId);
    if (!to) return;
    await sendEmail({
      to: to.email,
      ...aircraftDocumentReviewedEmail({
        name: to.name,
        locale: to.locale,
        registration: row.registration,
        kind: row.kind,
        decision,
        reason,
        url: `${appUrl()}/owner/aircraft/${row.aircraftId}/documents`,
      }),
    });
  } catch (e) {
    // The decision is saved either way; the owner also sees it on the documents page.
    console.error("[admin] couldn't email the owner", e);
  }
}
