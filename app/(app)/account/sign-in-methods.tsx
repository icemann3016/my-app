import { CheckIcon, KeyRoundIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ProviderIcon } from "@/components/auth/provider-icon";
import { SubmitButton } from "@/components/forms/submit-button";
import { PROVIDER_NAMES, SOCIAL_PROVIDERS, type SocialProvider } from "@/lib/auth/provider-list";
import { linkProvider, unlinkProvider } from "./actions";

/** Which ways the user can log in, with connect/disconnect for Google, Apple and Facebook. */
export async function SignInMethods({
  hasPassword,
  connected,
  enabled,
}: {
  hasPassword: boolean;
  /** Providers linked to this account. */
  connected: SocialProvider[];
  /** Providers configured on the site. */
  enabled: SocialProvider[];
}) {
  const t = await getTranslations("account.signIn");
  // Disconnecting is offered only while another way to log in remains.
  const ways = connected.length + (hasPassword ? 1 : 0);
  const shown = SOCIAL_PROVIDERS.filter((p) => enabled.includes(p) || connected.includes(p));
  return (
    <ul className="divide-y rounded-lg border">
      <li className="flex items-center gap-3 p-3">
        <KeyRoundIcon className="size-5 text-primary" aria-hidden />
        <span className="flex-1 text-sm font-medium">{t("password")}</span>
        <Status on={hasPassword} labels={{ on: t("active"), off: t("notSet") }} />
      </li>
      {shown.map((provider) => (
        <li key={provider} className="flex flex-wrap items-center gap-3 p-3">
          <span className="flex size-5 items-center justify-center">
            <ProviderIcon provider={provider} />
          </span>
          <span className="flex-1 text-sm font-medium">{PROVIDER_NAMES[provider]}</span>
          {connected.includes(provider) ? (
            <>
              <Status on labels={{ on: t("connected"), off: "" }} />
              {ways > 1 && (
                <form action={unlinkProvider}>
                  <input type="hidden" name="provider" value={provider} />
                  <SubmitButton
                    size="sm"
                    variant="ghost"
                    aria-label={`${t("disconnect")} ${PROVIDER_NAMES[provider]}`}
                  >
                    {t("disconnect")}
                  </SubmitButton>
                </form>
              )}
            </>
          ) : (
            enabled.includes(provider) && (
              <form action={linkProvider}>
                <input type="hidden" name="provider" value={provider} />
                <SubmitButton size="sm" variant="outline">
                  {t("connect", { provider: PROVIDER_NAMES[provider] })}
                </SubmitButton>
              </form>
            )
          )}
        </li>
      ))}
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
