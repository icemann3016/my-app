import { sql } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/lib/db";

/** Health check for load balancers and container platforms (Cloud Run, Azure Container Apps). */
export async function GET() {
  let database: "ok" | "error" | "not_configured" = "not_configured";
  if (isDatabaseConfigured()) {
    try {
      await getDb().execute(sql`select 1`);
      database = "ok";
    } catch {
      database = "error";
    }
  }
  const ok = database !== "error";
  return Response.json({ status: ok ? "ok" : "error", database }, { status: ok ? 200 : 503 });
}
