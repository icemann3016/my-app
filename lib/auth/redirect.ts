/**
 * Only allow redirects to paths on our own site (prevents "open redirect" attacks
 * like /login?next=https://evil.example).
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
