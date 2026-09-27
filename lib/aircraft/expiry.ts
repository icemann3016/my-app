import "server-only";

import { and, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { aircraft, aircraftDocuments } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { getRecipient } from "@/lib/email/recipient";
import { aircraftExpiryReminderEmail, aircraftUnlistedEmail } from "@/lib/email/templates";
import { EXPIRY_WARNING_DAYS, todayUtc } from "@/lib/pilot/validity";
import { appUrl } from "@/lib/site-url";

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Remind owners 30 days before an ARC or insurance expires, once per document. Rows are
 * claimed first (UPDATE … RETURNING) so overlapping runs can't double-send; undelivered
 * reminders are released and retried next time. Trusted code (daily job).
 */
export async function sendAircraftExpiryReminders(now = new Date()) {
  const db = getDb();
  const today = todayUtc(now);
  const claimed = await db
    .update(aircraftDocuments)
    .set({ reminderSentAt: now })
    .where(
      and(
        ne(aircraftDocuments.status, "rejected"),
        isNull(aircraftDocuments.reminderSentAt),
        gte(aircraftDocuments.expiresOn, today),
        lte(aircraftDocuments.expiresOn, addDays(today, EXPIRY_WARNING_DAYS)),
      ),
    )
    .returning({
      id: aircraftDocuments.id,
      aircraftId: aircraftDocuments.aircraftId,
      kind: aircraftDocuments.kind,
      expiresOn: aircraftDocuments.expiresOn,
    });
  if (!claimed.length) return { emails: 0, items: 0, notDelivered: 0 };

  const planes = await db
    .select({ id: aircraft.id, ownerId: aircraft.ownerId, registration: aircraft.registration })
    .from(aircraft)
    .where(
      inArray(
        aircraft.id,
        claimed.map((c) => c.aircraftId),
      ),
    );
  const byId = new Map(planes.map((p) => [p.id, p]));
  const items = claimed.map((c) => ({ ...c, plane: byId.get(c.aircraftId)! }));

  let emails = 0;
  let notDelivered = 0;
  for (const [ownerId, list] of Map.groupBy(items, (i) => i.plane.ownerId)) {
    let delivered = false;
    try {
      const to = await getRecipient(ownerId);
      if (to) {
        list.sort((a, b) => a.expiresOn!.localeCompare(b.expiresOn!));
        delivered = await sendEmail({
          to: to.email,
          ...aircraftExpiryReminderEmail({
            name: to.name,
            locale: to.locale,
            items: list.map((i) => ({
              registration: i.plane.registration,
              kind: i.kind,
              expiresOn: i.expiresOn!,
            })),
            url: `${appUrl()}/owner/aircraft`,
          }),
        });
      }
    } catch (e) {
      console.error("[aircraft] couldn't email an owner", e);
    }
    if (delivered) emails++;
    else {
      notDelivered += list.length;
      await db
        .update(aircraftDocuments)
        .set({ reminderSentAt: null })
        .where(
          inArray(
            aircraftDocuments.id,
            list.map((i) => i.id),
          ),
        );
    }
  }
  return { emails, items: claimed.length, notDelivered };
}

/**
 * Unlist listed or paused aircraft whose ARC or insurance is no longer valid (LST-6), and tell
 * the owner. The status reason "documents_expired" explains it on the owner's page.
 */
export async function unlistExpiredAircraft(now = new Date()) {
  const today = todayUtc(now);
  const valid = (kind: "arc" | "insurance") => sql`exists (
    select 1 from ${aircraftDocuments} d
    where d.aircraft_id = ${aircraft.id} and d.kind = ${kind}
      and d.status = 'verified' and d.expires_on >= ${today}
  )`;
  const unlisted = await getDb()
    .update(aircraft)
    .set({ status: "unlisted", statusReason: "documents_expired" })
    .where(
      and(
        inArray(aircraft.status, ["listed", "paused"]),
        sql`not (${valid("arc")} and ${valid("insurance")})`,
      ),
    )
    .returning({ id: aircraft.id, ownerId: aircraft.ownerId, registration: aircraft.registration });

  for (const a of unlisted) {
    try {
      const to = await getRecipient(a.ownerId);
      if (!to) continue;
      await sendEmail({
        to: to.email,
        ...aircraftUnlistedEmail({
          name: to.name,
          locale: to.locale,
          registration: a.registration,
          url: `${appUrl()}/owner/aircraft/${a.id}/documents`,
        }),
      });
    } catch (e) {
      console.error("[aircraft] couldn't email an owner", e);
    }
  }
  return { unlisted: unlisted.length };
}
