import { reportError } from "@/lib/monitoring";

/**
 * Errors of the browser (from app/error.tsx), passed on to error monitoring (KAN-70). Accepts
 * only a small JSON body with the error and the page path; nothing else is stored.
 */
export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > 6000) return new Response(null, { status: 413 });
  let body: { message?: unknown; name?: unknown; stack?: unknown; path?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
  const error = new Error(str(body.message, 500) ?? "Unknown client error");
  error.name = str(body.name, 100) ?? "Error";
  error.stack = str(body.stack, 4000);
  await reportError(error, { where: "client", path: str(body.path, 200) });
  return new Response(null, { status: 204 });
}
