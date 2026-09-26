import { sql } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/lib/db";
import { cn } from "@/lib/utils";

type Status = { tone: "ok" | "warn" | "error"; text: string };

async function checkDatabase(): Promise<Status> {
  if (!isDatabaseConfigured()) {
    return { tone: "warn", text: "Database not configured. Set DATABASE_URL in .env.local." };
  }
  try {
    await getDb().execute(sql`select 1`);
    return { tone: "ok", text: "Connected to the database" };
  } catch {
    return { tone: "error", text: "Can't reach the database. Check DATABASE_URL." };
  }
}

/** Development-only badge showing whether the app can reach its database. */
export async function DatabaseStatus() {
  if (process.env.NODE_ENV === "production") return null;
  const status = await checkDatabase();
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
        status.tone === "ok" && "border-success/40 text-success",
        status.tone === "warn" && "border-amber-500/40 text-amber-600 dark:text-amber-400",
        status.tone === "error" && "border-destructive/40 text-destructive",
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          status.tone === "ok" && "bg-success",
          status.tone === "warn" && "bg-amber-500",
          status.tone === "error" && "bg-destructive",
        )}
        aria-hidden
      />
      dev: {status.text}
    </p>
  );
}
