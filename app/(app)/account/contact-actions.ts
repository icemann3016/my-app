"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db/rls";
import { userSettings } from "@/lib/db/schema";
import { type FormState, formValues } from "@/lib/forms";
import { localizedFieldErrors } from "@/lib/i18n/server";
import { contactSchema } from "@/lib/validation/profile";

/** Save the phone number shown on accepted bookings (MSG-2). */
export async function saveContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/account");
  const t = await getTranslations("account.contact");
  const raw = formValues(formData);
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };
  await asUser(user.id, (tx) =>
    tx
      .update(userSettings)
      .set({ phone: parsed.data.phone })
      .where(eq(userSettings.userId, user.id)),
  );
  revalidatePath("/account");
  return { ok: true, message: t("saved"), values: { phone: parsed.data.phone ?? "" } };
}
