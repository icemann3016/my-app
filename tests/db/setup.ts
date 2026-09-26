import { execSync } from "node:child_process";

import { sql } from "drizzle-orm";

/**
 * Database tests run against TEST_DATABASE_URL (a throwaway database; it gets wiped!).
 * Without it they are skipped, so `npm test` works on any machine.
 */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

import { describe } from "vitest";

let prepared = false;

/** Reset the test database and apply all migrations. */
export async function prepareDatabase() {
  if (prepared || !TEST_DATABASE_URL) return;
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { getDb } = await import("@/lib/db");
  await getDb().execute(sql`drop schema if exists public cascade`);
  await getDb().execute(sql`drop schema if exists app cascade`);
  await getDb().execute(sql`drop schema if exists drizzle cascade`);
  await getDb().execute(sql`create schema public`);
  execSync("npx drizzle-kit migrate", {
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      DATABASE_URL_MIGRATIONS: TEST_DATABASE_URL,
    },
    stdio: "pipe",
  });
  prepared = true;
}
