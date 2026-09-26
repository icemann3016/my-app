import { eq } from "drizzle-orm";

import { getUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { accounts, profiles, sessions, userRoles, userSettings, users } from "@/lib/db/schema";

/**
 * "Download my data" (GDPR): everything we store about the logged-in user, as JSON.
 * Secrets (password hashes, OAuth tokens, session tokens) are left out on purpose.
 */
export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please log in again." }, { status: 401 });

  const db = getDb();
  const [account] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, user.id));
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, user.id));
  const roles = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
  const loginMethods = await db
    .select({
      provider: accounts.providerId,
      accountId: accounts.accountId,
      createdAt: accounts.createdAt,
    })
    .from(accounts)
    .where(eq(accounts.userId, user.id));
  const activeSessions = await db
    .select({
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
    })
    .from(sessions)
    .where(eq(sessions.userId, user.id));

  const data = {
    exportedAt: new Date().toISOString(),
    account,
    profile,
    settings,
    roles: roles.map((r) => ({ role: r.role, since: r.createdAt })),
    loginMethods,
    sessions: activeSessions,
  };
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="ownaplane-data-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}
