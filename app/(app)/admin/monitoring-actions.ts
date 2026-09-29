"use server";

import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { monitoringConfigured, reportError } from "@/lib/monitoring";

/** Send a test error to the monitoring service, to check SENTRY_DSN works (KAN-70). */
export async function sendTestError(): Promise<FormState> {
  await requireAdmin("/admin");
  const t = await getTranslations("admin.monitoring");
  if (!monitoringConfigured()) return { message: t("notConfigured") };
  const sent = await reportError(new Error("Test error from the ownAplane admin dashboard"), {
    where: "admin test",
    tags: { test: "true" },
  });
  return sent ? { ok: true, message: t("sent") } : { message: t("failed") };
}
