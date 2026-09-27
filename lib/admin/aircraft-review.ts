import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { aircraftTitle } from "@/lib/aircraft/catalog";
import { listingProblems } from "@/lib/aircraft/queries";
import { getDb } from "@/lib/db";
import { asUser } from "@/lib/db/rls";
import { adminActions, aircraft, aircraftDocuments, profiles } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { getRecipient } from "@/lib/email/recipient";
import { aircraftDocumentReviewedEmail } from "@/lib/email/templates";
import { appUrl } from "@/lib/site-url";

export type AircraftQueueEntry = {
  aircraftId: string;
  registration: string;
  title: string;
  ownerName: string;
  items: number;
  since: Date;
};

/** Aircraft with documents waiting for review, oldest first. Read as the admin (RLS). */
export async function getAircraftQueue(adminId: string): Promise<AircraftQueueEntry[]> {
  const rows = (await asUser(adminId, (tx) =>
    tx.execute(sql`
      select a.id, a.registration, a.manufacturer, a.model, pr.display_name,
             count(*)::int as items, min(d.updated_at) as since
      from ${aircraftDocuments} d
      join ${aircraft} a on a.id = d.aircraft_id
      join ${profiles} pr on pr.id = a.owner_id
      where d.status = 'pending'
      group by a.id, a.registration, a.manufacturer, a.model, pr.display_name
      order by since asc
      limit 200
    `),
  )) as unknown as {
    id: string;
    registration: string;
    manufacturer: string | null;
    model: string | null;
    display_name: string;
    items: number;
    since: string;
  }[];
  return rows.map((r) => ({
    aircraftId: r.id,
    registration: r.registration,
    title: aircraftTitle(r),
    ownerName: r.display_name,
    items: r.items,
    since: new Date(r.since),
  }));
}

export type AircraftReviewResult =
  | { ok: true; aircraftId: string; listed: boolean }
  | { ok: false; error: "notFound" | "ownItem" | "changed" };

/**
 * Verify or reject an aircraft document (CofA, ARC, insurance). Trusted admin code after
 * requireAdmin(); same rules as pilot credentials: no self-review, optimistic `version` check.
 * If the owner asked to publish and this was the last missing check, the aircraft goes live.
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
    .select({ doc: aircraftDocuments, ownerId: aircraft.ownerId })
    .from(aircraftDocuments)
    .innerJoin(aircraft, eq(aircraft.id, aircraftDocuments.aircraftId))
    .where(eq(aircraftDocuments.id, id));
  if (!row) return { ok: false, error: "notFound" };
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

  const listed = decision === "verify" ? await listIfRequested(row.doc.aircraftId) : false;
  await notifyOwner(row.doc.aircraftId, row.ownerId, row.doc.kind, decision, reason, listed);
  return { ok: true, aircraftId: row.doc.aircraftId, listed };
}

/** Publishes an aircraft whose owner asked for it, once nothing is missing any more. */
async function listIfRequested(aircraftId: string): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [a] = await tx
      .select({ status: aircraft.status, requested: aircraft.publishRequestedAt })
      .from(aircraft)
      .where(eq(aircraft.id, aircraftId))
      .for("update");
    if (!a?.requested || a.status === "listed" || a.status === "grounded") return false;
    if ((await listingProblems(tx, aircraftId)).length) return false;
    await tx.update(aircraft).set({ status: "listed" }).where(eq(aircraft.id, aircraftId));
    return true;
  });
}

async function notifyOwner(
  aircraftId: string,
  ownerId: string,
  kind: "cofa" | "arc" | "insurance",
  decision: "verify" | "reject",
  reason: string | null,
  listed: boolean,
) {
  try {
    const [a] = await getDb()
      .select({ registration: aircraft.registration })
      .from(aircraft)
      .where(eq(aircraft.id, aircraftId));
    const to = await getRecipient(ownerId);
    if (!a || !to) return;
    await sendEmail({
      to: to.email,
      ...aircraftDocumentReviewedEmail({
        name: to.name,
        locale: to.locale,
        registration: a.registration,
        kind,
        decision,
        reason,
        listed,
        url: `${appUrl()}/owner/aircraft/${aircraftId}`,
      }),
    });
  } catch (e) {
    console.error("[admin] couldn't email the owner", e);
  }
}
