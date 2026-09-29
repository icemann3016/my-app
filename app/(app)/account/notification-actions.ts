"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db/rls";
import { userSettings } from "@/lib/db/schema";
import type { FormState } from "@/lib/forms";
import { NOTIFICATION_SETTINGS, type NotificationSettings } from "@/lib/notifications/settings";

/** Save which notifications arrive by email and in the app (MSG-3). Unticked = off. */
export async function saveNotificationSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/account");
  const t = await getTranslations("account.notifications");
  const values = Object.fromEntries(
    NOTIFICATION_SETTINGS.map((key) => [key, formData.get(key) === "on"]),
  ) as NotificationSettings;
  await asUser(user.id, (tx) =>
    tx.update(userSettings).set(values).where(eq(userSettings.userId, user.id)),
  );
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: t("saved"),
    values: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v ? "on" : ""])),
  };
}
