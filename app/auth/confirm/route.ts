import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { safeNextPath } from "@/lib/auth/redirect";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing URL for links in auth emails (confirm sign-up, reset password) and OAuth logins.
 * Supports both link styles Supabase can send:
 *   ?token_hash=…&type=…  (recommended email template, works on any device)
 *   ?code=…               (default template / OAuth, must be opened in the same browser)
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");

  let errorMessage: string | null =
    params.get("error_description") ?? (getSupabaseEnv() ? null : "Supabase isn't configured.");

  if (!errorMessage) {
    const supabase = await createClient();
    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      errorMessage = error?.message ?? null;
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      errorMessage = error?.message ?? null;
    } else {
      errorMessage = "The link is missing its token.";
    }
  }

  if (!errorMessage) redirect(next);
  redirect(`/auth-error?reason=${encodeURIComponent(errorMessage)}`);
}
