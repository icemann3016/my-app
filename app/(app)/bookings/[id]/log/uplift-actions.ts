"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { getUnits } from "@/lib/aircraft/queries";
import { getAirport } from "@/lib/airports";
import { requireUser } from "@/lib/auth/session";
import { getBooking } from "@/lib/bookings/queries";
import { asUser } from "@/lib/db/rls";
import { flightUplifts } from "@/lib/db/schema";
import { type FormState, formValues } from "@/lib/forms";
import { localizedFieldErrors } from "@/lib/i18n/server";
import { upliftSchema } from "@/lib/validation/flight-log";

/** Add or change fuel or oil added during the rental (BKG-13, BKG-14). */
export async function saveUplift(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/bookings");
  const t = await getTranslations("flightLog");
  const v = await getTranslations("validation");
  const raw = formValues(formData);
  const detail = await getBooking(user.id, raw.bookingId ?? "");
  if (!detail) return { message: t("errors.not_found") };
  const parsed = upliftSchema(await getUnits(user.id), detail.aircraft.oilUnit).safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };
  const { logId, upliftId, airport, ...values } = parsed.data;
  const found = await getAirport(airport);
  if (!found) return { errors: { airport: [v("airportUnknown")] }, values: raw };
  const row = { ...values, airportIdent: found.ident };
  try {
    const saved = await asUser(user.id, (tx) =>
      upliftId
        ? tx
            .update(flightUplifts)
            .set(row)
            .where(and(eq(flightUplifts.id, upliftId), eq(flightUplifts.flightLogId, logId)))
            .returning({ id: flightUplifts.id })
        : tx
            .insert(flightUplifts)
            .values({ ...row, flightLogId: logId })
            .returning({ id: flightUplifts.id }),
    );
    if (!saved.length) return { message: t("errors.not_editable"), values: raw };
  } catch (e) {
    const code = (e as { cause?: { code?: string } }).cause?.code;
    if (code === "42501") return { message: t("errors.not_editable"), values: raw };
    throw e;
  }
  revalidatePath(`/bookings/${detail.booking.id}`, "layout");
  return { ok: true, message: t("upliftSaved") };
}

/** Remove fuel or oil added while the log is still editable. */
export async function deleteUplift(formData: FormData) {
  const user = await requireUser("/bookings");
  const upliftId = z.uuid().parse(formData.get("upliftId"));
  const bookingId = z.uuid().parse(formData.get("bookingId"));
  await asUser(user.id, (tx) => tx.delete(flightUplifts).where(eq(flightUplifts.id, upliftId)));
  revalidatePath(`/bookings/${bookingId}`, "layout");
}
