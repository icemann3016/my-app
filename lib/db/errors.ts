/** Postgres error code and hint of a failed query (drizzle wraps the driver error in `cause`). */
export function pgError(e: unknown): { code?: string; hint?: string } {
  const err = e as { code?: string; hint?: string; cause?: { code?: string; hint?: string } };
  return { code: err.cause?.code ?? err.code, hint: err.cause?.hint ?? err.hint };
}
