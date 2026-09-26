import { getTranslations } from "next-intl/server";

import { signInWithGoogle } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { richLink } from "@/components/rich-link";
import { isGoogleEnabled } from "@/lib/auth/google";

/** "Continue with Google" + an "or" divider. Renders nothing when Google isn't configured. */
export async function GoogleSignIn({
  next,
  showTerms = false,
}: {
  next?: string;
  showTerms?: boolean;
}) {
  if (!isGoogleEnabled()) return null;
  const t = await getTranslations("google");

  return (
    <div className="grid gap-4">
      <form action={signInWithGoogle} className="grid gap-2">
        {next && <input type="hidden" name="next" value={next} />}
        <SubmitButton variant="outline">{t("continue")}</SubmitButton>
        {showTerms && (
          <p className="text-center text-xs text-muted-foreground">
            {t.rich("termsNote", { terms: richLink("/terms"), privacy: richLink("/privacy") })}
          </p>
        )}
      </form>
      <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
        <span className="h-px flex-1 bg-border" />
        {t("or")}
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
