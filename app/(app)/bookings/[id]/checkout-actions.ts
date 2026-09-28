"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { requireUser } from "@/lib/auth/session";
import { getBooking } from "@/lib/bookings/queries";
import { asUser } from "@/lib/db/rls";
import { aircraftCheckouts } from "@/lib/db/schema";
import { type FormState, formValues } from "@/lib/forms";
import { localizedFieldErrors } from "@/lib/i18n/server";
import { checkoutRecordSchema } from "@/lib/validation/checkout";

/** The owner records that the pilot did their checkout flight on the aircraft (BKG-10). */
export async function recordCheckout(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/bookings");
  const t = await getTranslations("checkoutFlight");
  const raw = formValues(formData);
  const parsed = checkoutRecordSchema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };
  const detail = await getBooking(user.id, parsed.data.bookingId);
  const b = detail?.booking;
  if (!b || b.ownerId !== user.id || !b.pilotId) return { message: t("failed"), values: raw };
  const { doneOn, instructor, note } = parsed.data;
  // RLS: only the aircraft's owner, and only for pilots who booked it.
  await asUser(user.id, (tx) =>
    tx
      .insert(aircraftCheckouts)
      .values({ aircraftId: b.aircraftId, pilotId: b.pilotId!, doneOn, instructor, note })
      .onConflictDoUpdate({
        target: [aircraftCheckouts.aircraftId, aircraftCheckouts.pilotId],
        set: { doneOn, instructor, note },
      }),
  );
  revalidatePath(`/bookings/${b.id}`);
  return { ok: true, message: t("saved") };
}
