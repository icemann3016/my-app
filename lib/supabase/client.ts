import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/types/database";
import { requireSupabaseEnv } from "./env";

/** Supabase client for Client Components (runs in the browser, uses the user's session). */
export function createClient() {
  const { url, publishableKey } = requireSupabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
