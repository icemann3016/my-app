import { getTranslations } from "next-intl/server";

import { signInWithProvider } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { richLink } from "@/components/rich-link";
import { enabledProviders, PROVIDER_NAMES } from "@/lib/auth/providers";
import { ProviderIcon } from "./provider-icon";

/**
 * "Continue with Google / Apple / Facebook" + an "or" divider. Shows only the providers whose keys
 * are configured, and nothing at all when none are.
 */
export async function SocialSignIn({
  next,
  showTerms = false,
}: {
  next?: string;
  showTerms?: boolean;
}) {
  const providers = enabledProviders();
  if (providers.length === 0) return null;
  const t = await getTranslations("social");

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        {providers.map((provider) => (
          <form key={provider} action={signInWithProvider} className="grid">
            <input type="hidden" name="provider" value={provider} />
            {next && <input type="hidden" name="next" value={next} />}
            <SubmitButton variant="outline">
              <ProviderIcon provider={provider} />
              {t("continue", { provider: PROVIDER_NAMES[provider] })}
            </SubmitButton>
          </form>
        ))}
        {showTerms && (
          <p className="text-center text-xs text-muted-foreground">
            {t.rich("termsNote", { terms: richLink("/terms"), privacy: richLink("/privacy") })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
        <span className="h-px flex-1 bg-border" />
        {t("or")}
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
