/**
 * Public base URL of the site (no trailing slash), for links in emails and redirects.
 * BETTER_AUTH_URL (e.g. https://ownaplane.eu) → the Vercel address → localhost.
 * Works without a request, so the daily job can use it too.
 */
export function appUrl(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL.replace(/\/+$/, "");
  const vercelUrl =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  if (process.env.NODE_ENV === "production") {
    console.warn("[site] BETTER_AUTH_URL is not set: links in emails may be wrong.");
  }
  return "http://localhost:3000";
}
