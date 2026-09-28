"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireUser } from "@/lib/auth/session";
import { type FormState, formValues } from "@/lib/forms";
import { localizedFieldErrors } from "@/lib/i18n/server";
import { sendMessage, startConversation } from "@/lib/messages";
import { sendMessageEmailsSoon } from "@/lib/messages/soon";
import { enquirySchema, messageSchema } from "@/lib/validation/message";

/** Send a message in a conversation (MSG-1). */
export async function sendMessageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/messages");
  const t = await getTranslations("messages");
  const raw = formValues(formData);
  const parsed = messageSchema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };
  const result = await sendMessage(user.id, parsed.data.conversationId, parsed.data.body);
  if (!result.ok) {
    return {
      message: t(result.error === "not_found" ? "errors.not_found" : "errors.failed"),
      values: raw,
    };
  }
  sendMessageEmailsSoon();
  revalidatePath(`/messages/${parsed.data.conversationId}`);
  return { ok: true };
}

/** First message about a listing, before any booking (MSG-1). */
export async function startEnquiryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formValues(formData);
  const user = await requireUser(`/messages/new?aircraft=${raw.aircraftId ?? ""}`);
  const t = await getTranslations("messages");
  const parsed = enquirySchema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };
  const result = await startConversation(
    user.id,
    { aircraftId: parsed.data.aircraftId, bookingId: null },
    parsed.data.body,
  );
  if (!result.ok) {
    return {
      message: t(result.error === "not_found" ? "errors.not_found" : "errors.failed"),
      values: raw,
    };
  }
  sendMessageEmailsSoon();
  redirect(`/messages/${result.value}`);
}
