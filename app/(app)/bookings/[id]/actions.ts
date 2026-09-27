"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { getAirport } from "@/lib/airports";
import { requireUser } from "@/lib/auth/session";
import { getBooking } from "@/lib/bookings/queries";
import { respondToBooking } from "@/lib/bookings/respond";
import { zonedToUtc } from "@/lib/domain/time";
import { type FormState, formValues } from "@/lib/forms";
import { localizedFieldErrors } from "@/lib/i18n/server";
import { bookingResponseSchema } from "@/lib/validation/booking";

/** The owner accepts, declines or suggests another time (BKG-3). */
export async function answerBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/bookings");
  const t = await getTranslations("booking.respond");
  const raw = formValues(formData);
  const parsed = bookingResponseSchema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };
  const { bookingId, decision, note } = parsed.data;

  let proposal: { from: Date; to: Date } | null = null;
  if (decision === "propose") {
    const detail = await getBooking(user.id, bookingId);
    const zone = (await getAirport(detail?.booking.departureIdent))?.timezone ?? "UTC";
    const from = zonedToUtc(parsed.data.proposeFrom!, zone);
    const to = zonedToUtc(parsed.data.proposeTo!, zone);
    if (!from || !to || to <= from) {
      const v = await getTranslations("validation");
      return { errors: { proposeTo: [v("endBeforeStart")] }, values: raw };
    }
    proposal = { from, to };
  }

  const outcome = await respondToBooking(
    user.id,
    bookingId,
    decision === "accept" ? "accept" : "decline",
    note || null,
    proposal,
  );
  if (!outcome.ok) {
    const known = ["not_found", "not_open", "pilot_not_eligible", "bad_proposal"];
    return {
      message: t(
        `errors.${known.includes(outcome.error) ? outcome.error : "failed"}` as "errors.failed",
      ),
      values: raw,
    };
  }
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
  return { ok: true, message: t(`done.${decision}`) };
}
