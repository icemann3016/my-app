import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getAuth } from "@/lib/auth/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { asUser } from "@/lib/db/rls";
import { type AppRole, type Profile, profiles, userRoles } from "@/lib/db/schema";

export type CurrentProfile = {
  userId: string;
  email: string;
  profile: Profile;
  roles: AppRole[];
};

/** The logged-in user's session, or null. Cached for the duration of one request. */
export const getSession = cache(async () => {
  // Session-dependent: always render per request.
  await connection();
  if (!isDatabaseConfigured()) return null;
  return getAuth().api.getSession({ headers: await headers() });
});

export const getUser = cache(async () => (await getSession())?.user ?? null);

/** The logged-in user's profile and roles, or null. Cached per request. */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const user = await getUser();
  if (!user) return null;

  return asUser(user.id, async (tx) => {
    const [profile] = await tx.select().from(profiles).where(eq(profiles.id, user.id));
    if (!profile) return null;
    const roles = await tx
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, user.id));
    return { userId: user.id, email: user.email, profile, roles: roles.map((r) => r.role) };
  });
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
