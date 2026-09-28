import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { asUser } from "@/lib/db/rls";
import { aircraft, defects, profiles, type DefectSeverity } from "@/lib/db/schema";
import { getRecipient } from "@/lib/email/recipient";
import { sendEmail } from "@/lib/email";
import { defectReportedEmail } from "@/lib/email/templates";
import { appUrl } from "@/lib/site-url";

export type DefectReport = {
  aircraftId: string;
  bookingId: string | null;
  severity: DefectSeverity;
  description: string;
  photoId: string | null;
};

/**
 * Report a defect (BKG-8) and email the aircraft's owner straight away. Returns the defect id, or
 * the database's error code (not_found, description_required, bad_photo).
 */
export async function reportDefect(
  userId: string,
  r: DefectReport,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  let id: string;
  try {
    const [row] = (await asUser(userId, (tx) =>
      tx.execute(sql`select public.report_defect(${r.aircraftId}::uuid, ${r.bookingId}::uuid,
        ${r.severity}::public.defect_severity, ${r.description}, ${r.photoId}::uuid) as id`),
    )) as unknown as { id: string }[];
    id = row!.id;
  } catch (e) {
    const err = (e as { cause?: { code?: string; message?: string } }).cause;
    if (err?.code === "P0001" && err.message) return { ok: false, error: err.message };
    throw e;
  }
  await notifyOwner(userId, r).catch((e) =>
    // The defect is saved either way; the owner also sees it in the aircraft's Defects tab.
    console.error("[defects] couldn't email the owner", e),
  );
  return { ok: true, id };
}

async function notifyOwner(reporterId: string, r: DefectReport) {
  // Trusted read after report_defect() checked the reporter may report on this aircraft.
  const db = getDb();
  const [plane] = await db
    .select({ ownerId: aircraft.ownerId, registration: aircraft.registration })
    .from(aircraft)
    .where(eq(aircraft.id, r.aircraftId));
  if (!plane || plane.ownerId === reporterId) return;
  const [reporter] = await db
    .select({ name: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.id, reporterId));
  const to = await getRecipient(plane.ownerId);
  if (!to) return;
  await sendEmail({
    to: to.email,
    ...defectReportedEmail({
      name: to.name,
      locale: to.locale,
      registration: plane.registration,
      reporter: reporter?.name ?? "",
      severity: r.severity,
      description: r.description,
      url: `${appUrl()}/owner/aircraft/${r.aircraftId}/defects`,
    }),
  });
}

/** Defects of an aircraft for its owner, newest first, with who reported them (RLS). */
export async function getAircraftDefects(ownerId: string, aircraftId: string) {
  return asUser(ownerId, (tx) =>
    tx
      .select({ defect: defects, reporter: profiles.displayName })
      .from(defects)
      .leftJoin(profiles, eq(profiles.id, defects.reportedBy))
      .where(and(eq(defects.aircraftId, aircraftId)))
      .orderBy(desc(defects.createdAt))
      .limit(200),
  );
}
