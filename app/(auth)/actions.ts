"use server";

import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getAuth } from "@/lib/auth/auth";
import { safeNextPath } from "@/lib/auth/redirect";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { formValues, type FormState, withoutSecrets } from "@/lib/forms";
import { isLocale } from "@/lib/i18n/config";
import { localizedFieldErrors, setLocaleCookie } from "@/lib/i18n/server";
import {
  emailOnlySchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

/** Better Auth error code, e.g. "USER_ALREADY_EXISTS". */
function errorCode(error: unknown): string | undefined {
  return error instanceof APIError ? (error.body?.code as string | undefined) : undefined;
}

type MessageKey =
  | "wrongCredentials"
  | "emailNotVerified"
  | "userExists"
  | "passwordLength"
  | "linkExpired"
  | "tooManyRequests"
  | "generic";

function messageKey(code: string | undefined): MessageKey {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "wrongCredentials";
    case "EMAIL_NOT_VERIFIED":
      return "emailNotVerified";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "userExists";
    case "PASSWORD_TOO_SHORT":
    case "PASSWORD_TOO_LONG":
      return "passwordLength";
    case "INVALID_TOKEN":
    case "TOKEN_EXPIRED":
      return "linkExpired";
    case "TOO_MANY_REQUESTS":
      return "tooManyRequests";
    default:
      return "generic";
  }
}

async function authMessage(code: string | undefined) {
  const t = await getTranslations("authMessages");
  return t(messageKey(code));
}

async function notConfigured(values?: Record<string, string>): Promise<FormState> {
  const t = await getTranslations("authMessages");
  return { message: t("notConfigured"), values };
}

function logUnexpected(action: string, error: unknown) {
  if (!(error instanceof APIError)) console.error(`[auth] ${action} failed`, error);
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formValues(formData);
  const values = withoutSecrets(raw);
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values };
  if (!isDatabaseConfigured()) return notConfigured(values);

  const { displayName, email, password } = parsed.data;
  let signedIn = false;
  try {
    const result = await getAuth().api.signUpEmail({
      body: { name: displayName, email, password, callbackURL: "/dashboard" },
      headers: await headers(),
    });
    signedIn = Boolean(result.token);
    // Keep the language they signed up in (for the app and emails).
    await getDb()
      .update(userSettings)
      .set({ locale: await getLocale() })
      .where(eq(userSettings.userId, result.user.id));
  } catch (error) {
    logUnexpected("sign-up", error);
    const code = errorCode(error);
    return { message: await authMessage(code), code, values };
  }

  revalidatePath("/", "layout");
  // With email verification switched on, no session exists until the link is clicked.
  redirect(signedIn ? "/dashboard" : "/signup/check-email");
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formValues(formData);
  const values = withoutSecrets(raw);
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values };
  if (!isDatabaseConfigured()) return notConfigured(values);

  try {
    const result = await getAuth().api.signInEmail({ body: parsed.data, headers: await headers() });
    // Switch to the user's saved language.
    const [settings] = await getDb()
      .select({ locale: userSettings.locale })
      .from(userSettings)
      .where(eq(userSettings.userId, result.user.id));
    if (isLocale(settings?.locale)) await setLocaleCookie(settings.locale);
  } catch (error) {
    logUnexpected("sign-in", error);
    const code = errorCode(error);
    return {
      message: await authMessage(code),
      code: code === "EMAIL_NOT_VERIFIED" ? "email_not_confirmed" : code,
      values,
    };
  }

  revalidatePath("/", "layout");
  redirect(safeNextPath(raw.next));
}

/** Start "Continue with Google": redirects to Google, which returns to /api/auth/callback/google. */
export async function signInWithGoogle(formData: FormData) {
  const next = safeNextPath(formData.get("next")?.toString());
  const { url } = await getAuth().api.signInSocial({
    body: {
      provider: "google",
      callbackURL: next,
      newUserCallbackURL: "/dashboard",
      errorCallbackURL: "/login?error=oauth",
    },
    headers: await headers(),
  });
  if (!url) redirect("/login?error=oauth");
  redirect(url);
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
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };
  if (!isDatabaseConfigured()) return notConfigured(raw);

  try {
    await getAuth().api.requestPasswordReset({
      body: { email: parsed.data.email, redirectTo: "/reset-password" },
      headers: await headers(),
    });
  } catch (error) {
    logUnexpected("password reset request", error);
    const code = errorCode(error);
    if (code === "TOO_MANY_REQUESTS") return { message: await authMessage(code), values: raw };
  }
  // Same answer whether or not the account exists.
  const t = await getTranslations("authMessages");
  return { ok: true, message: t("resetSent") };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formValues(formData);
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: await localizedFieldErrors(parsed.error), values: withoutSecrets(raw) };
  }
  if (!isDatabaseConfigured()) return notConfigured();

  try {
    await getAuth().api.resetPassword({
      body: { newPassword: parsed.data.password, token: parsed.data.token },
      headers: await headers(),
    });
  } catch (error) {
    logUnexpected("password reset", error);
    return { message: await authMessage(errorCode(error)) };
  }
  redirect("/login?reset=1");
}

export async function resendConfirmation(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formValues(formData);
  const parsed = emailOnlySchema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };
  if (!isDatabaseConfigured()) return notConfigured(raw);

  try {
    await getAuth().api.sendVerificationEmail({
      body: { email: parsed.data.email, callbackURL: "/dashboard" },
      headers: await headers(),
    });
  } catch (error) {
    logUnexpected("resend verification", error);
    const code = errorCode(error);
    if (code === "TOO_MANY_REQUESTS") return { message: await authMessage(code), values: raw };
  }
  const t = await getTranslations("authMessages");
  return { ok: true, message: t("verificationSent") };
}

/** Change the language (any visitor). Logged-in users also get it saved to their settings. */
export async function setLanguage(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  await setLocaleCookie(locale);
  if (isDatabaseConfigured()) {
    const session = await getAuth().api.getSession({ headers: await headers() });
    if (session) {
      await getDb()
        .update(userSettings)
        .set({ locale })
        .where(eq(userSettings.userId, session.user.id));
    }
  }
  revalidatePath("/", "layout");
}
