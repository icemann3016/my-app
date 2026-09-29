/**
 * Errors that come back in the URL (?error=...) after email links or Google/Apple/Facebook sign-in,
 * mapped to a message key in the "login" namespace.
 */
export function loginErrorKey(
  code: string | undefined,
): "linkExpired" | "accountNotLinked" | "emailMissing" | "oauthFailed" | "suspended" | null {
  if (!code) return null;
  const c = code.toLowerCase();
  if (c === "account_not_linked") return "accountNotLinked";
  if (c === "account_suspended") return "suspended";
  // Facebook accounts made with a phone number (or email sharing declined) have no email.
  if (c === "email_not_found") return "emailMissing";
  if (["invalid_token", "token_expired", "expired_token"].includes(c)) return "linkExpired";
  return "oauthFailed";
}

/**
 * Error code of an expected Better Auth error (e.g. "INVALID_EMAIL_OR_PASSWORD"), or undefined.
 * Checked by name, not `instanceof`: in development the library can be loaded twice.
 */
export function authErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error) || error.name !== "APIError") return undefined;
  const code = (error as Error & { body?: { code?: unknown } }).body?.code;
  return typeof code === "string" ? code : undefined;
}

export function isAuthApiError(error: unknown): boolean {
  return error instanceof Error && error.name === "APIError";
}
