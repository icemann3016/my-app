"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/lib/auth/auth";
import { safeNextPath } from "@/lib/auth/redirect";
import { isDatabaseConfigured } from "@/lib/db";
import { fieldErrors, formValues, type FormState, withoutSecrets } from "@/lib/forms";
import {
  emailOnlySchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

const NOT_CONFIGURED: FormState = {
  message: "Accounts aren't available yet: the database isn't configured for this site.",
};

/** Better Auth error code, e.g. "USER_ALREADY_EXISTS". */
function errorCode(error: unknown): string | undefined {
  return error instanceof APIError ? (error.body?.code as string | undefined) : undefined;
}

function friendlyMessage(code: string | undefined): string {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Wrong email or password.";
    case "EMAIL_NOT_VERIFIED":
      return "Please confirm your email address first. Check your inbox for the link.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with this email already exists. Try logging in.";
    case "PASSWORD_TOO_SHORT":
    case "PASSWORD_TOO_LONG":
      return "Use a password between 8 and 72 characters.";
    case "INVALID_TOKEN":
    case "TOKEN_EXPIRED":
      return "This link has expired or was already used. Please request a new one.";
    case "TOO_MANY_REQUESTS":
      return "Too many attempts. Please wait a minute and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

function logUnexpected(action: string, error: unknown) {
  if (!(error instanceof APIError)) console.error(`[auth] ${action} failed`, error);
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formValues(formData);
  const values = withoutSecrets(raw);
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  if (!isDatabaseConfigured()) return { ...NOT_CONFIGURED, values };

  const { displayName, email, password } = parsed.data;
  let signedIn = false;
  try {
    const result = await getAuth().api.signUpEmail({
      body: { name: displayName, email, password, callbackURL: "/dashboard" },
      headers: await headers(),
    });
    signedIn = Boolean(result.token);
  } catch (error) {
    logUnexpected("sign-up", error);
    const code = errorCode(error);
    return { message: friendlyMessage(code), code, values };
  }

  revalidatePath("/", "layout");
  // With email verification switched on, no session exists until the link is clicked.
  redirect(signedIn ? "/dashboard" : "/signup/check-email");
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formValues(formData);
  const values = withoutSecrets(raw);
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  if (!isDatabaseConfigured()) return { ...NOT_CONFIGURED, values };

  try {
    await getAuth().api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (error) {
    logUnexpected("sign-in", error);
    const code = errorCode(error);
    return {
      message: friendlyMessage(code),
      code: code === "EMAIL_NOT_VERIFIED" ? "email_not_confirmed" : code,
      values,
    };
  }

  revalidatePath("/", "layout");
  redirect(safeNextPath(raw.next));
}

export async function signOut() {
  if (isDatabaseConfigured()) {
    await getAuth().api.signOut({ headers: await headers() });
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
  if (!isDatabaseConfigured()) return { ...NOT_CONFIGURED, values: raw };

  try {
    await getAuth().api.requestPasswordReset({
      body: { email: parsed.data.email, redirectTo: "/reset-password" },
      headers: await headers(),
    });
  } catch (error) {
    logUnexpected("password reset request", error);
    const code = errorCode(error);
    if (code === "TOO_MANY_REQUESTS") return { message: friendlyMessage(code), values: raw };
  }
  // Same answer whether or not the account exists.
  return {
    ok: true,
    message: "If an account exists for that email, we've sent a link to reset your password.",
  };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formValues(formData);
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: withoutSecrets(raw) };
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  try {
    await getAuth().api.resetPassword({
      body: { newPassword: parsed.data.password, token: parsed.data.token },
      headers: await headers(),
    });
  } catch (error) {
    logUnexpected("password reset", error);
    return { message: friendlyMessage(errorCode(error)) };
  }
  redirect("/login?reset=1");
}

export async function resendConfirmation(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formValues(formData);
  const parsed = emailOnlySchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  if (!isDatabaseConfigured()) return { ...NOT_CONFIGURED, values: raw };

  try {
    await getAuth().api.sendVerificationEmail({
      body: { email: parsed.data.email, callbackURL: "/dashboard" },
      headers: await headers(),
    });
  } catch (error) {
    logUnexpected("resend verification", error);
    const code = errorCode(error);
    if (code === "TOO_MANY_REQUESTS") return { message: friendlyMessage(code), values: raw };
  }
  return {
    ok: true,
    message: "If that address is waiting for confirmation, we've sent a new link.",
  };
}
