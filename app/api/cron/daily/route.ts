import { timingSafeEqual } from "node:crypto";

import { sendAircraftExpiryReminders, unlistExpiredAircraft } from "@/lib/aircraft/expiry";
import { deleteOrphanDocuments } from "@/lib/documents";
import { sendExpiryReminders } from "@/lib/pilot/reminders";

/**
 * Daily maintenance, called by a scheduler with `Authorization: Bearer $CRON_SECRET`:
 * Vercel Cron (vercel.json) sends it automatically; on Google Cloud use Cloud Scheduler, on
 * Azure a Container Apps job or Logic App (see docs/deployment.md).
 * - emails pilots whose credentials expire within 30 days
 * - unlists aircraft whose ARC or insurance expired, and reminds owners 30 days before
 * - removes uploads older than a day that were never attached to a credential or aircraft
 */
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const reminders = await sendExpiryReminders();
  const unlistedAircraft = await unlistExpiredAircraft();
  const aircraftReminders = await sendAircraftExpiryReminders();
  const orphanDocuments = await deleteOrphanDocuments(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const result = { reminders, unlistedAircraft, aircraftReminders, orphanDocuments };
  console.info("[cron] daily", result);
  return Response.json({ ok: true, ...result });
}
