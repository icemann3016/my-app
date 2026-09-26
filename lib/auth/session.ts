import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import type { Enums, Tables } from "@/lib/types/database";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  userId: string;
  email: string | null;
  profile: Tables<"profiles">;
  roles: Enums<"app_role">[];
};

/** The logged-in user, or null. Cached for the duration of one request. */
export const getUser = cache(async () => {
  // Session-dependent: always render per request (even when Supabase isn't configured yet).
  await connection();
  if (!getSupabaseEnv()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** The logged-in user's profile and roles, or null. Cached per request. */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  if (!profile) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    profile,
    roles: (roles ?? []).map((r) => r.role),
  };
});

function loginUrl(nextPath?: string) {
  return nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
}

/** Use at the top of pages and Server Actions that need a logged-in user. */
export async function requireUser(nextPath?: string) {
  const user = await getUser();
  if (!user) redirect(loginUrl(nextPath));
  return user;
}

export async function requireProfile(nextPath?: string) {
  const current = await getCurrentProfile();
  if (!current) redirect(loginUrl(nextPath));
  return current;
}
