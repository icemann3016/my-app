import { headers } from "next/headers";
import Script from "next/script";

/**
 * Cookie-less page statistics (KAN-70), only when configured: Plausible
 * (NEXT_PUBLIC_ANALYTICS_SRC + NEXT_PUBLIC_ANALYTICS_DOMAIN) or Umami
 * (NEXT_PUBLIC_ANALYTICS_SRC + NEXT_PUBLIC_ANALYTICS_WEBSITE_ID). No cookies, no personal
 * profiles, so no consent banner is needed (see the cookie policy).
 */
export async function Analytics() {
  const src = process.env.NEXT_PUBLIC_ANALYTICS_SRC;
  if (!src) return null;
  // The Content-Security-Policy only allows scripts with this request's nonce (proxy.ts).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const domain = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN;
  const websiteId = process.env.NEXT_PUBLIC_ANALYTICS_WEBSITE_ID;
  return (
    <Script
      src={src}
      nonce={nonce}
      strategy="afterInteractive"
      {...(domain ? { "data-domain": domain } : {})}
      {...(websiteId ? { "data-website-id": websiteId } : {})}
    />
  );
}
