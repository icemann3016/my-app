// Content-Security-Policy (security review, docs/security-review.md). Built per request with a
// nonce in proxy.ts; Next.js puts the nonce on its own scripts. Only our own origin plus what the
// app really loads: storage images, the map tiles, and the optional statistics script.

const host = (url: string | undefined) => {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
};

export function contentSecurityPolicy(nonce: string, dev = false): string {
  const map = host(process.env.NEXT_PUBLIC_MAP_STYLE_URL) ?? "https://tiles.openfreemap.org";
  const storage = host(process.env.STORAGE_PUBLIC_BASE_URL);
  const analytics = host(process.env.NEXT_PUBLIC_ANALYTICS_SRC);
  const images = [
    "'self'",
    "data:",
    "blob:",
    "https://*.supabase.co",
    "https://storage.googleapis.com",
    "https://*.blob.core.windows.net",
    storage,
    map,
  ];
  const directives: Record<string, (string | null)[]> = {
    "default-src": ["'self'"],
    // 'strict-dynamic': scripts loaded by nonce-carrying scripts may load more (Next chunks).
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", dev ? "'unsafe-eval'" : null],
    "style-src": ["'self'", `'nonce-${nonce}'`],
    // style="…" attributes (React style props, Radix, the map) can't carry a nonce.
    "style-src-attr": ["'unsafe-inline'"],
    "img-src": images,
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", map, analytics, dev ? "ws:" : null],
    "worker-src": ["'self'", "blob:"],
    "child-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", "https://accounts.google.com"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values.filter(Boolean)].join(" "))
    .join("; ");
}
