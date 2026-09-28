import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Where uploaded images are served from (Supabase Storage, Google Cloud Storage, Azure Blob…).
const storageHost = process.env.STORAGE_PUBLIC_BASE_URL
  ? new URL(process.env.STORAGE_PUBLIC_BASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // Self-contained server build for Docker (Cloud Run, Azure Container Apps…): the Dockerfile
  // sets NEXT_OUTPUT=standalone. Vercel and `npm run start` use the normal build.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // Pilot credentials moved under Account (links in older emails still work).
  async redirects() {
    return [{ source: "/pilot", destination: "/account/credentials", permanent: true }];
  },
  // Security headers on every response (security review, docs/security-review.md). No full
  // CSP yet: the map (web workers, tiles) and Next's inline scripts would need nonces.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()",
          },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
  // Help articles are read from content/help at request time; ship them with the server.
  outputFileTracingIncludes: {
    "/help/**": ["./content/help/**/*"],
    "/terms": ["./content/legal/**/*"],
    "/privacy": ["./content/legal/**/*"],
    "/cookies": ["./content/legal/**/*"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "*.blob.core.windows.net" },
      ...(storageHost ? [{ protocol: "https" as const, hostname: storageHost }] : []),
    ],
  },
};

// Translations: see i18n/request.ts and messages/*.json
export default createNextIntlPlugin()(nextConfig);
