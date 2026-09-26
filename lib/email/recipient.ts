import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { userSettings, users } from "@/lib/db/schema";

/** Email address, name and language of a user (trusted server code only). */
export async function getRecipient(userId: string) {
  const [row] = await getDb()
    .select({ email: users.email, name: users.name, locale: userSettings.locale })
    .from(users)
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(eq(users.id, userId));
  return row ?? null;
}
