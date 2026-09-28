import Script from "next/script";

/**
 * Cookie-less page statistics (KAN-70), only when configured: Plausible
 * (NEXT_PUBLIC_ANALYTICS_SRC + NEXT_PUBLIC_ANALYTICS_DOMAIN) or Umami
 * (NEXT_PUBLIC_ANALYTICS_SRC + NEXT_PUBLIC_ANALYTICS_WEBSITE_ID). No cookies, no personal
 * profiles, so no consent banner is needed (see the cookie policy).
 */
export function Analytics() {
  const src = process.env.NEXT_PUBLIC_ANALYTICS_SRC;
  if (!src) return null;
  const domain = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN;
  const websiteId = process.env.NEXT_PUBLIC_ANALYTICS_WEBSITE_ID;
  return (
    <Script
      src={src}
      strategy="afterInteractive"
      {...(domain ? { "data-domain": domain } : {})}
      {...(websiteId ? { "data-website-id": websiteId } : {})}
    />
  );
}
