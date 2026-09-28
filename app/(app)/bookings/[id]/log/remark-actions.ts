"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { getAirport } from "@/lib/airports";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db/rls";
import { flightRemarks } from "@/lib/db/schema";
import { type FormState, formValues } from "@/lib/forms";
import { localizedFieldErrors } from "@/lib/i18n/server";
import { remarkSchema } from "@/lib/validation/flight-log";

/** The pilot adds a remark or PIREP to the log (BKG-15). */
export async function addRemark(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/bookings");
  const t = await getTranslations("flightLog");
  const v = await getTranslations("validation");
  const raw = formValues(formData);
  const bookingId = z.uuid().safeParse(raw.bookingId);
  if (!bookingId.success) return { message: t("errors.not_found") };
  const parsed = remarkSchema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };
  const { logId, kind, airport, body } = parsed.data;
  const found = airport ? await getAirport(airport) : null;
  if (airport && !found) return { errors: { airport: [v("airportUnknown")] }, values: raw };
  try {
    await asUser(user.id, (tx) =>
      tx.insert(flightRemarks).values({
        flightLogId: logId,
        // Filled in from the booking by a database trigger.
        aircraftId: sql`null`,
        kind,
        airportIdent: found?.ident ?? null,
        body,
      }),
    );
  } catch (e) {
    const code = (e as { cause?: { code?: string } }).cause?.code;
    if (code === "42501") return { message: t("errors.not_editable"), values: raw };
    throw e;
  }
  revalidatePath(`/bookings/${bookingId.data}`, "layout");
  return { ok: true, message: t("remarkSaved") };
}

/** The pilot removes a remark while the log is editable (not once it's a known item). */
export async function deleteRemark(formData: FormData) {
  const user = await requireUser("/bookings");
  const remarkId = z.uuid().parse(formData.get("remarkId"));
  const bookingId = z.uuid().parse(formData.get("bookingId"));
  await asUser(user.id, (tx) => tx.delete(flightRemarks).where(eq(flightRemarks.id, remarkId)));
  revalidatePath(`/bookings/${bookingId}`, "layout");
}
