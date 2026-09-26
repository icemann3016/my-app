import "server-only";

import { and, gte, inArray, isNull, lte, ne } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { medicals, pilotLicences, pilotRatings } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { getRecipient } from "@/lib/email/recipient";
import { expiryReminderEmail } from "@/lib/email/templates";
import { appUrl } from "@/lib/site-url";
import type { CredentialRef } from "./labels";
import { EXPIRY_WARNING_DAYS, todayUtc } from "./validity";

type Due = {
  table: "licence" | "rating" | "medical";
  id: string;
  userId: string;
  ref: CredentialRef;
  expiresOn: string;
};

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Claim the credentials that expire within the window and haven't been reminded yet, by setting
 * reminder_sent_at in one UPDATE … RETURNING. Two overlapping runs can't claim the same rows.
 */
async function claimDue(today: string, until: string, sentAt: Date): Promise<Due[]> {
  const db = getDb();
  const [licences, ratings, meds] = await Promise.all([
    db
      .update(pilotLicences)
      .set({ reminderSentAt: sentAt })
      .where(
        and(
          ne(pilotLicences.status, "rejected"),
          isNull(pilotLicences.reminderSentAt),
          gte(pilotLicences.expiresOn, today),
          lte(pilotLicences.expiresOn, until),
        ),
      )
      .returning(),
    db
      .update(pilotRatings)
      .set({ reminderSentAt: sentAt })
      .where(
        and(
          ne(pilotRatings.status, "rejected"),
          isNull(pilotRatings.reminderSentAt),
          gte(pilotRatings.expiresOn, today),
          lte(pilotRatings.expiresOn, until),
        ),
      )
      .returning(),
    db
      .update(medicals)
      .set({ reminderSentAt: sentAt })
      .where(
        and(
          ne(medicals.status, "rejected"),
          isNull(medicals.reminderSentAt),
          gte(medicals.validUntil, today),
          lte(medicals.validUntil, until),
        ),
      )
      .returning(),
  ]);
  return [
    ...licences.map((l) => ({
      table: "licence" as const,
      id: l.id,
      userId: l.userId,
      ref: { kind: "licence" as const, type: l.type },
      expiresOn: l.expiresOn!,
    })),
    ...meds.map((m) => ({
      table: "medical" as const,
      id: m.id,
      userId: m.userId,
      ref: { kind: "medical" as const, class: m.class },
      expiresOn: m.validUntil,
    })),
    ...ratings.map((r) => ({
      table: "rating" as const,
      id: r.id,
      userId: r.userId,
      ref: { kind: "rating" as const, ratingKind: r.kind, code: r.code },
      expiresOn: r.expiresOn!,
    })),
  ];
}

/** Give claimed items back (the email wasn't delivered), so the next run tries again. */
async function release(items: Due[]) {
  const db = getDb();
  const ids = (kind: Due["table"]) => items.filter((i) => i.table === kind).map((i) => i.id);
  if (ids("licence").length) {
    await db
      .update(pilotLicences)
      .set({ reminderSentAt: null })
      .where(inArray(pilotLicences.id, ids("licence")));
  }
  if (ids("rating").length) {
    await db
      .update(pilotRatings)
      .set({ reminderSentAt: null })
      .where(inArray(pilotRatings.id, ids("rating")));
  }
  if (ids("medical").length) {
    await db
      .update(medicals)
      .set({ reminderSentAt: null })
      .where(inArray(medicals.id, ids("medical")));
  }
}

/**
 * Email pilots whose credentials expire within 30 days, once per credential (reminder_sent_at).
 * Rejected items are skipped. Editing a credential clears reminder_sent_at (database trigger),
 * so a renewed item that is again close to expiry gets a new reminder. If an email isn't
 * delivered (error, or no real email service yet), its items are tried again on the next run.
 * Trusted code (daily job): owner connection.
 */
export async function sendExpiryReminders(
  now = new Date(),
): Promise<{ emails: number; items: number; notDelivered: number }> {
  const today = todayUtc(now);
  const due = await claimDue(today, addDays(today, EXPIRY_WARNING_DAYS), now);

  let emails = 0;
  let notDelivered = 0;
  for (const [userId, items] of Map.groupBy(due, (d) => d.userId)) {
    let delivered = false;
    try {
      const to = await getRecipient(userId);
      if (to) {
        items.sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
        delivered = await sendEmail({
          to: to.email,
          ...expiryReminderEmail({
            name: to.name,
            locale: to.locale,
            items,
            url: `${appUrl()}/pilot`,
          }),
        });
      }
    } catch (e) {
      console.error("[reminders] couldn't email a pilot", e);
    }
    if (delivered) {
      emails++;
    } else {
      notDelivered += items.length;
      await release(items);
    }
  }
  return { emails, items: due.length, notDelivered };
}
