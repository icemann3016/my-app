import "server-only";

import { headers } from "next/headers";

/** Base URL of the site for the current request, used in links inside emails. */
export async function getSiteUrl(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;

  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = host.startsWith("localhost") ? "http" : (h.get("x-forwarded-proto") ?? "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
