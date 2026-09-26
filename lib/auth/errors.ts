/**
 * Errors that come back in the URL (?error=...) after email links or Google sign-in,
 * mapped to a message key in the "login" namespace.
 */
export function loginErrorKey(
  code: string | undefined,
): "linkExpired" | "accountNotLinked" | "oauthFailed" | null {
  if (!code) return null;
  const c = code.toLowerCase();
  if (c === "account_not_linked") return "accountNotLinked";
  if (["invalid_token", "token_expired", "expired_token"].includes(c)) return "linkExpired";
  return "oauthFailed";
}
