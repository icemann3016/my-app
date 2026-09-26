import "server-only";

/** "Continue with Google" is shown only when Google OAuth keys are configured. */
export function isGoogleEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
