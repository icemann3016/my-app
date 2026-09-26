import { getSupabaseEnv } from "@/lib/supabase/env";

/** Public URL of a file in the avatars bucket. */
export function avatarUrl(path: string | null | undefined): string | null {
  const env = getSupabaseEnv();
  if (!path || !env) return null;
  return `${env.url}/storage/v1/object/public/avatars/${path}`;
}

/** "Alice Pilot" → "AP", "bob" → "B". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters.map((p) => p[0]!.toUpperCase()).join("") || "?";
}
