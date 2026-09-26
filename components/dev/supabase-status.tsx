import { getSupabaseEnv } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

type Status = { tone: "ok" | "warn" | "error"; text: string };

async function checkSupabase(): Promise<Status> {
  const env = getSupabaseEnv();
  if (!env) {
    return {
      tone: "warn",
      text: "Supabase not configured. Fill in .env.local (see .env.example).",
    };
  }
  try {
    const res = await fetch(`${env.url}/auth/v1/health`, {
      headers: { apikey: env.publishableKey },
      cache: "no-store",
    });
    if (res.ok) return { tone: "ok", text: `Connected to Supabase (${new URL(env.url).host})` };
    return { tone: "error", text: `Supabase responded ${res.status}. Check the URL and key.` };
  } catch {
    return { tone: "error", text: "Can't reach Supabase. Check NEXT_PUBLIC_SUPABASE_URL." };
  }
}

/** Development-only badge showing whether the app can reach Supabase. */
export async function SupabaseStatus() {
  if (process.env.NODE_ENV === "production") return null;
  const status = await checkSupabase();
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
