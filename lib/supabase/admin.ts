import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { requireSupabaseEnv } from "./env";

/**
 * ⚠️ Admin client: uses the SECRET key and BYPASSES Row Level Security.
 * Only for trusted server code (admin actions, cron jobs). Never import from client code.
 * Always check that the caller is allowed to do the action before using it.
 */
export function createAdminClient() {
  const { url } = requireSupabaseEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not set.");

  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
