import { CheckIcon, KeyRoundIcon, LogInIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { SubmitButton } from "@/components/forms/submit-button";
import { linkGoogle, unlinkGoogle } from "./actions";

/** Which ways the user can log in, with connect/disconnect for Google. */
export async function SignInMethods({
  hasPassword,
  hasGoogle,
  googleEnabled,
}: {
  hasPassword: boolean;
  hasGoogle: boolean;
  googleEnabled: boolean;
}) {
  const t = await getTranslations("account.signIn");
  return (
    <ul className="divide-y rounded-lg border">
      <li className="flex items-center gap-3 p-3">
        <KeyRoundIcon className="size-5 text-primary" aria-hidden />
        <span className="flex-1 text-sm font-medium">{t("password")}</span>
        <Status on={hasPassword} labels={{ on: t("active"), off: t("notSet") }} />
      </li>
      {(googleEnabled || hasGoogle) && (
        <li className="flex flex-wrap items-center gap-3 p-3">
          <LogInIcon className="size-5 text-primary" aria-hidden />
          <span className="flex-1 text-sm font-medium">Google</span>
          {hasGoogle ? (
            <>
              <Status on labels={{ on: t("connected"), off: "" }} />
              {hasPassword && (
                <form action={unlinkGoogle}>
                  <SubmitButton size="sm" variant="ghost">
                    {t("disconnect")}
                  </SubmitButton>
                </form>
              )}
            </>
          ) : (
            <form action={linkGoogle}>
              <SubmitButton size="sm" variant="outline">
                {t("connectGoogle")}
              </SubmitButton>
            </form>
          )}
        </li>
      )}
    </ul>
  );
}

function Status({ on, labels }: { on: boolean; labels: { on: string; off: string } }) {
  return on ? (
    <span className="flex items-center gap-1 text-xs font-medium text-success">
      <CheckIcon className="size-3.5" aria-hidden /> {labels.on}
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">{labels.off}</span>
  );
}
