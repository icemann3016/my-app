"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import type { NotificationSetting, NotificationSettings } from "@/lib/notifications/settings";
import { saveNotificationSettings } from "./notification-actions";

const ROWS: {
  key: "bookings" | "reviews" | "messages";
  email: NotificationSetting;
  inApp?: NotificationSetting;
}[] = [
  { key: "bookings", email: "emailBookings", inApp: "inAppBookings" },
  { key: "reviews", email: "emailReviews", inApp: "inAppReviews" },
  { key: "messages", email: "emailMessages" },
];

/** Email / in-app choices per kind of notification (MSG-3). */
export function NotificationForm({ settings }: { settings: NotificationSettings }) {
  const t = useTranslations("account.notifications");
  const [state, formAction] = useActionState(saveNotificationSettings, initialFormState);
  const checked = (key: NotificationSetting) =>
    state.values ? state.values[key] === "on" : settings[key];
  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{t("caption")}</caption>
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="py-2 pr-3 font-medium">
              {t("kind")}
            </th>
            <th scope="col" className="w-20 py-2 text-center font-medium">
              {t("email")}
            </th>
            <th scope="col" className="w-20 py-2 text-center font-medium">
              {t("inApp")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {ROWS.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="py-3 pr-3 font-normal">
                <span className="font-medium">{t(`kinds.${row.key}.label`)}</span>
                <span className="block text-xs text-muted-foreground">
                  {t(`kinds.${row.key}.hint`)}
                </span>
              </th>
              <td className="py-3 text-center">
                <input
                  type="checkbox"
                  name={row.email}
                  defaultChecked={checked(row.email)}
                  key={`${row.email}-${checked(row.email)}`}
                  aria-label={t("aria", { kind: t(`kinds.${row.key}.label`), channel: t("email") })}
                  className="size-4 accent-primary"
                />
              </td>
              <td className="py-3 text-center">
                {row.inApp ? (
                  <input
                    type="checkbox"
                    name={row.inApp}
                    defaultChecked={checked(row.inApp)}
                    key={`${row.inApp}-${checked(row.inApp)}`}
                    aria-label={t("aria", {
                      kind: t(`kinds.${row.key}.label`),
                      channel: t("inApp"),
                    })}
                    className="size-4 accent-primary"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">{t("always")}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">{t("alwaysSent")}</p>
      <SubmitButton className="justify-self-start" pendingText={t("saving")}>
        {t("save")}
      </SubmitButton>
    </form>
  );
}
