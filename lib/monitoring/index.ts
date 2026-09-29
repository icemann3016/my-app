import { randomUUID } from "node:crypto";

// Error monitoring without an SDK (KAN-70): errors are sent to any Sentry-compatible service
// (Sentry, GlitchTip…) through its envelope API when SENTRY_DSN is set; otherwise only logged.
// No cookies, headers or user data are sent: just the error, where it happened and the release.

type Dsn = { url: string; key: string };

export function parseDsn(dsn: string | undefined): Dsn | null {
  // Tolerate quotes or spaces pasted around the value in the hosting settings.
  const value = dsn
    ?.trim()
    .replace(/^["']|["']$/g, "")
    .trim();
  if (!value) return null;
  try {
    const u = new URL(value);
    const parts = u.pathname.split("/").filter(Boolean);
    const project = parts.pop();
    if (!u.username || !project) return null;
    const prefix = parts.length ? `/${parts.join("/")}` : "";
    return { url: `${u.protocol}//${u.host}${prefix}/api/${project}/envelope/`, key: u.username };
  } catch {
    return null;
  }
}

/** Stack frames in the order Sentry expects (oldest call first). */
export function stackFrames(stack: string | undefined) {
  if (!stack) return [];
  return stack
    .split("\n")
    .map((line) => line.match(/^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => ({
      function: m[1] ?? "?",
      filename: m[2]!.replace(process.cwd(), ""),
      lineno: Number(m[3]),
      colno: Number(m[4]),
      in_app: !m[2]!.includes("node_modules"),
    }))
    .reverse()
    .slice(-50);
}

export type ErrorContext = {
  /** Where: a route path, "cron", "client"… */
  where: string;
  method?: string;
  /** Request path without the query string (queries can hold personal data). */
  path?: string;
  digest?: string;
  tags?: Record<string, string>;
};

/**
 * Report an error (awaitable; never throws). Resolves to true when the monitoring service
 * accepted it, false when it isn't configured or the report failed.
 */
export async function reportError(error: unknown, context: ErrorContext): Promise<boolean> {
  const err = error instanceof Error ? error : new Error(String(error));
  const digest =
    context.digest ??
    (typeof error === "object" && error && "digest" in error ? String(error.digest) : undefined);
  console.error(`[error] ${context.where}${digest ? ` (${digest})` : ""}:`, err);
  const dsn = parseDsn(process.env.SENTRY_DSN);
  if (!dsn) return false;
  const eventId = randomUUID().replaceAll("-", "");
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "node",
    level: "error",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.APP_RELEASE,
    transaction: context.path?.split("?")[0],
    tags: { where: context.where, ...context.tags },
    request: context.path ? { method: context.method, url: context.path.split("?")[0] } : undefined,
    extra: digest ? { digest } : undefined,
    exception: {
      values: [
        {
          type: err.name,
          value: err.message.slice(0, 1000),
          stacktrace: { frames: stackFrames(err.stack) },
        },
      ],
    },
  };
  const body = [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
  try {
    const response = await fetch(dsn.url, {
      method: "POST",
      headers: {
        "content-type": "application/x-sentry-envelope",
        "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${dsn.key}, sentry_client=ownaplane/1`,
      },
      body,
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) console.warn(`[error] the error report was refused (${response.status})`);
    return response.ok;
  } catch (e) {
    console.warn("[error] couldn't send the error report", e);
    return false;
  }
}

/** Whether error reports go to a monitoring service: SENTRY_DSN missing, not a DSN, or ok. */
export function monitoringStatus(): "missing" | "invalid" | "ok" {
  if (!process.env.SENTRY_DSN?.trim()) return "missing";
  return parseDsn(process.env.SENTRY_DSN) ? "ok" : "invalid";
}
