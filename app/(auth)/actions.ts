"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth/redirect";
import { fieldErrors, formValues, type FormState, withoutSecrets } from "@/lib/forms";
import { getSiteUrl } from "@/lib/site-url";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { emailOnlySchema, signInSchema, signUpSchema } from "@/lib/validation/auth";

const NOT_CONFIGURED: FormState = {
  message: "Accounts aren't available yet: Supabase isn't configured for this site.",
};

/** Turn Supabase auth errors into friendly messages. */
function authErrorMessage(error: { code?: string; message: string }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Wrong email or password.";
    case "email_not_confirmed":
      return "Please confirm your email address first. Check your inbox for the link.";
    case "weak_password":
      return "Please choose a stronger password.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Try logging in.";
    default:
      return error.message;
  }
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formValues(formData);
  const values = withoutSecrets(raw);
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  if (!getSupabaseEnv()) return { ...NOT_CONFIGURED, values };

  const { displayName, email, password } = parsed.data;
  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm?next=/dashboard`,
      data: { display_name: displayName },
    },
  });
  if (error) return { message: authErrorMessage(error), code: error.code, values };

  // Email confirmation switched off in Supabase: the user is logged in straight away.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }
  redirect("/signup/check-email");
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formValues(formData);
  const values = withoutSecrets(raw);
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  if (!getSupabaseEnv()) return { ...NOT_CONFIGURED, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { message: authErrorMessage(error), code: error.code, values };

  revalidatePath("/", "layout");
  redirect(safeNextPath(raw.next));
}

export async function signOut() {
  if (getSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formValues(formData);
  const parsed = emailOnlySchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  if (!getSupabaseEnv()) return { ...NOT_CONFIGURED, values: raw };

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/account/password`,
  });
  // Don't reveal whether an account exists, except for rate limits.
  if (error?.code?.startsWith("over_")) return { message: authErrorMessage(error), values: raw };
  return {
    ok: true,
    message: "If an account exists for that email, we've sent a link to reset your password.",
  };
}

export async function resendConfirmation(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formValues(formData);
  const parsed = emailOnlySchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  if (!getSupabaseEnv()) return { ...NOT_CONFIGURED, values: raw };

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${siteUrl}/auth/confirm?next=/dashboard` },
  });
  if (error?.code?.startsWith("over_")) return { message: authErrorMessage(error), values: raw };
  return {
    ok: true,
    message: "If that address is waiting for confirmation, we've sent a new link.",
  };
}
