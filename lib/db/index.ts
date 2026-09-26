import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

function createDb(url: string) {
  const client = postgres(url, {
    // Works with connection poolers in transaction mode (Supabase, PgBouncer, Cloud SQL, Azure).
    prepare: false,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
  });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// Reuse one connection pool per server process (and across hot reloads in development).
const globalForDb = globalThis as unknown as { db?: Db };

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** The database as the table owner. Bypasses RLS: only for auth and trusted server code. */
export function getDb(): Db {
  if (!globalForDb.db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
    }
    globalForDb.db = createDb(url);
  }
  return globalForDb.db;
}

export { schema };
