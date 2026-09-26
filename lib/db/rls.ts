import "server-only";

import { sql } from "drizzle-orm";

import { getDb, type Tx } from "./index";

/**
 * Run queries as a logged-in user. Row Level Security policies in the database decide what
 * they can see and change (they use app.current_user_id()). Use this for all user data.
 */
export async function asUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    await tx.execute(sql`set local role app_user`);
    return fn(tx);
  });
}

/** Run queries as an anonymous visitor (only public data is visible). */
export async function asAnon<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', '', true)`);
    await tx.execute(sql`set local role app_user`);
    return fn(tx);
  });
}
