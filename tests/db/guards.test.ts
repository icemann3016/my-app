import { sql } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";

import { describeDb, prepareDatabase } from "./setup";

// Security review guards (KAN-69, docs/security-review.md): rules every migration must keep.
let db: typeof import("@/lib/db");

const rows = async <T>(query: ReturnType<typeof sql>) =>
  (await db.getDb().execute(query)) as unknown as T[];

describeDb("security guards", () => {
  beforeAll(async () => {
    await prepareDatabase();
    db = await import("@/lib/db");
  }, 60_000);

  it("has row-level security on every table", async () => {
    const open = await rows<{ relname: string }>(sql`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(open).toEqual([]);
  });

  it("gives the app role nothing on the login tables", async () => {
    const grants = await rows<{ table_name: string }>(sql`
      select distinct table_name from information_schema.role_table_grants
      where grantee = 'app_user' and table_schema = 'public'
        and table_name in ('users', 'sessions', 'accounts', 'verifications', 'rate_limits')`);
    expect(grants).toEqual([]);
  });

  it("pins the search path of every SECURITY DEFINER function", async () => {
    const loose = await rows<{ proname: string }>(sql`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'app') and p.prosecdef
        and not coalesce(p.proconfig::text[] @> array['search_path=""'], false)`);
    expect(loose).toEqual([]);
  });

  it("doesn't let PUBLIC run SECURITY DEFINER functions (other than triggers)", async () => {
    const open = await rows<{ proname: string }>(sql`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'app') and p.prosecdef
        and p.prorettype <> 'trigger'::regtype
        and has_function_privilege('public', p.oid, 'execute')`);
    expect(open).toEqual([]);
  });
});
