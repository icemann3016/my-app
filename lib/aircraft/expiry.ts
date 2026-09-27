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
 * Unlist listed aircraft that no longer have a valid, verified ARC or insurance (LST-6) and tell
 * their owners. Trusted code (daily job): owner connection.
 */
export async function unlistExpiredAircraft(): Promise<number> {
  const unlisted = (await getDb().execute(sql`
    update ${aircraft} a
    set status = 'unlisted',
        unlisted_reason = case when 'arc' = any(g.gaps) then 'arc' else 'insurance' end
    from (select id, public.aircraft_listing_gaps(id) as gaps from ${aircraft}
          where status = 'listed') g
    where a.id = g.id and ('arc' = any(g.gaps) or 'insurance' = any(g.gaps))
    returning a.id, a.owner_id, a.registration, a.unlisted_reason
  `)) as unknown as {
    id: string;
    owner_id: string;
    registration: string;
    unlisted_reason: "arc" | "insurance";
  }[];

  for (const a of unlisted) {
    try {
      const to = await getRecipient(a.owner_id);
      if (!to) continue;
      await sendEmail({
        to: to.email,
        ...aircraftUnlistedEmail({
          name: to.name,
          locale: to.locale,
          registration: a.registration,
          reason: a.unlisted_reason,
          url: `${appUrl()}/owner/aircraft/${a.id}/documents`,
        }),
      });
    } catch (e) {
      // The aircraft is unlisted either way; the owner sees why on the listing.
      console.error("[aircraft] couldn't email the owner about unlisting", e);
    }
  }
  return unlisted.length;
}

/**
 * Email owners whose CofA, ARC or insurance expires within 30 days, once per document
 * (reminder_sent_at, claimed in one UPDATE so overlapping runs can't send twice). Items whose
 * email isn't delivered are released and tried again on the next run.
 */
export async function sendAircraftExpiryReminders(
  now = new Date(),
): Promise<{ emails: number; items: number; notDelivered: number }> {
  const today = todayUtc(now);
  const db = getDb();
  const claimed = await db
    .update(aircraftDocuments)
    .set({ reminderSentAt: now })
    .where(
      and(
        inArray(aircraftDocuments.kind, ["cofa", "arc", "insurance"]),
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
    .where(inArray(aircraft.id, [...new Set(claimed.map((c) => c.aircraftId))]));
  const byId = new Map(planes.map((p) => [p.id, p]));
  const items = claimed.map((c) => ({
    ...c,
    expiresOn: c.expiresOn!,
    plane: byId.get(c.aircraftId)!,
  }));

  let emails = 0;
  let notDelivered = 0;
  for (const [ownerId, list] of Map.groupBy(items, (i) => i.plane.ownerId)) {
    let delivered = false;
    try {
      const to = await getRecipient(ownerId);
      if (to) {
        list.sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
        delivered = await sendEmail({
          to: to.email,
          ...aircraftExpiryReminderEmail({
            name: to.name,
            locale: to.locale,
            items: list.map((i) => ({
              registration: i.plane.registration,
              kind: i.kind,
              expiresOn: i.expiresOn,
            })),
            url: `${appUrl()}/owner/aircraft`,
          }),
        });
      }
    } catch (e) {
      console.error("[aircraft] couldn't email an owner", e);
    }
    if (delivered) {
      emails++;
    } else {
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
