import { and, eq, sql } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";

import { describeDb, prepareDatabase } from "./setup";

// Imported lazily after DATABASE_URL points at the test database.
let db: typeof import("@/lib/db");
let rls: typeof import("@/lib/db/rls");
let s: typeof import("@/lib/db/schema");

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

/** Postgres error code from a failed query (drizzle wraps the driver error). */
async function pgCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    return err.cause?.code ?? err.code;
  }
}

describeDb("database security (RLS, grants, triggers)", () => {
  beforeAll(async () => {
    await prepareDatabase();
    db = await import("@/lib/db");
    rls = await import("@/lib/db/rls");
    s = await import("@/lib/db/schema");
    // Users are created by Better Auth using the owner connection.
    await db
      .getDb()
      .insert(s.users)
      .values([
        { id: ALICE, name: "Alice Pilot", email: "alice@example.com" },
        { id: BOB, name: "", email: "bob@example.com" },
      ]);
    // Airports are imported with the owner connection.
    await db.getDb().insert(s.airports).values({
      ident: "LBSF",
      type: "large_airport",
      name: "Sofia Airport",
      icaoCode: "LBSF",
      country: "BG",
      latitude: 42.69,
      longitude: 23.41,
      timezone: "Europe/Sofia",
    });
  }, 60_000);

  it("creates a profile and settings for each new user", async () => {
    const rows = await db.getDb().select().from(s.profiles);
    expect(rows.find((p) => p.id === ALICE)?.displayName).toBe("Alice Pilot");
    expect(rows.find((p) => p.id === BOB)?.displayName).toBe("bob"); // falls back to email name
    const settings = await db.getDb().select().from(s.userSettings);
    expect(settings).toHaveLength(2);
  });

  it("has RLS switched on for every table", async () => {
    const rows = await db
      .getDb()
      .execute<{ tablename: string; rowsecurity: boolean }>(
        sql`select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename <> '__drizzle_migrations'`,
      );
    expect(rows.length).toBeGreaterThanOrEqual(8);
    for (const row of rows) expect(row.rowsecurity, row.tablename).toBe(true);
  });

  it("lets anonymous visitors read public profiles only", async () => {
    const profiles = await rls.asAnon((tx) => tx.select().from(s.profiles));
    expect(profiles.length).toBe(2);
    expect(await rls.asAnon((tx) => tx.select().from(s.userSettings))).toEqual([]);
    expect(await pgCode(rls.asAnon((tx) => tx.select().from(s.users)))).toBe("42501");
    expect(await pgCode(rls.asAnon((tx) => tx.select().from(s.sessions)))).toBe("42501");
  });

  it("stops anonymous visitors changing anything", async () => {
    const updated = await rls.asAnon((tx) =>
      tx.update(s.profiles).set({ displayName: "x" }).where(eq(s.profiles.id, ALICE)).returning(),
    );
    expect(updated).toEqual([]);
    expect(
      await pgCode(
        rls.asAnon((tx) => tx.insert(s.userRoles).values({ userId: ALICE, role: "pilot" })),
      ),
    ).toBe("42501");
  });

  it("lets a user edit their own profile", async () => {
    await rls.asUser(ALICE, (tx) =>
      tx
        .update(s.profiles)
        .set({ displayName: "Alice P.", bio: "PPL(A), SEP", homeAirportIdent: "LBSF" })
        .where(eq(s.profiles.id, ALICE)),
    );
    const [row] = await db.getDb().select().from(s.profiles).where(eq(s.profiles.id, ALICE));
    expect(row?.displayName).toBe("Alice P.");
  });

  it("stops a user editing someone else's profile", async () => {
    const updated = await rls.asUser(ALICE, (tx) =>
      tx
        .update(s.profiles)
        .set({ displayName: "Hacked" })
        .where(eq(s.profiles.id, BOB))
        .returning(),
    );
    expect(updated).toEqual([]);
  });

  it("stops a user changing their rating or suspension", async () => {
    const ownRow = eq(s.profiles.id, ALICE);
    expect(
      await pgCode(
        rls.asUser(ALICE, (tx) => tx.update(s.profiles).set({ ratingAvg: 5 }).where(ownRow)),
      ),
    ).toBe("42501");
    expect(
      await pgCode(
        rls.asUser(ALICE, (tx) => tx.update(s.profiles).set({ suspendedAt: null }).where(ownRow)),
      ),
    ).toBe("42501");
  });

  it("rejects home airfields that don't exist", async () => {
    expect(
      await pgCode(
        rls.asUser(ALICE, (tx) =>
          tx.update(s.profiles).set({ homeAirportIdent: "ZZZZ" }).where(eq(s.profiles.id, ALICE)),
        ),
      ),
    ).toBe("23503");
  });

  it("allows only ready-made avatars or photos in the user's own folder", async () => {
    const setAvatar = (key: string) =>
      rls.asUser(ALICE, (tx) =>
        tx.update(s.profiles).set({ avatarKey: key }).where(eq(s.profiles.id, ALICE)),
      );
    expect(await pgCode(setAvatar("preset:jet"))).toBeUndefined();
    expect(await pgCode(setAvatar(`avatars/${ALICE}/1.jpg`))).toBeUndefined();
    expect(await pgCode(setAvatar(`avatars/${BOB}/1.jpg`))).toBe("23514");
    expect(await pgCode(setAvatar("documents/secret.pdf"))).toBe("23514");
    expect(await pgCode(setAvatar("preset:../x"))).toBe("23514");
  });

  it("lets everyone read airports but nobody change them", async () => {
    const found = await rls.asAnon((tx) =>
      tx.select().from(s.airports).where(eq(s.airports.ident, "LBSF")),
    );
    expect(found[0]?.name).toBe("Sofia Airport");
    expect(
      await pgCode(
        rls.asUser(ALICE, (tx) =>
          tx.update(s.airports).set({ name: "Hacked" }).where(eq(s.airports.ident, "LBSF")),
        ),
      ),
    ).toBe("42501");
    expect(
      await pgCode(
        rls.asAnon((tx) =>
          tx.insert(s.airports).values({
            ident: "FAKE",
            type: "small_airport",
            name: "Fake",
            country: "BG",
            latitude: 0,
            longitude: 0,
            timezone: "UTC",
          }),
        ),
      ),
    ).toBe("42501");
  });

  it("keeps settings private to each user", async () => {
    const mine = await rls.asUser(ALICE, (tx) => tx.select().from(s.userSettings));
    expect(mine.map((r) => r.userId)).toEqual([ALICE]);
    await rls.asUser(ALICE, (tx) =>
      tx.update(s.userSettings).set({ locale: "bg" }).where(eq(s.userSettings.userId, ALICE)),
    );
  });

  it("lets users switch pilot/owner roles but never admin", async () => {
    await rls.asUser(ALICE, (tx) =>
      tx.insert(s.userRoles).values({ userId: ALICE, role: "pilot" }),
    );
    expect(
      await pgCode(
        rls.asUser(ALICE, (tx) => tx.insert(s.userRoles).values({ userId: ALICE, role: "admin" })),
      ),
    ).toBe("42501");
    expect(
      await pgCode(
        rls.asUser(ALICE, (tx) => tx.insert(s.userRoles).values({ userId: BOB, role: "owner" })),
      ),
    ).toBe("42501");
    await rls.asUser(ALICE, (tx) =>
      tx
        .delete(s.userRoles)
        .where(and(eq(s.userRoles.userId, ALICE), eq(s.userRoles.role, "pilot"))),
    );
    const roles = await rls.asAnon((tx) => tx.select().from(s.userRoles));
    expect(roles).toEqual([]);
  });

  it("detects admins with user_has_role()", async () => {
    await db.getDb().insert(s.userRoles).values({ userId: BOB, role: "admin" });
    const [row] = await db
      .getDb()
      .execute<{ ok: boolean }>(sql`select public.user_has_role('admin', ${BOB}::uuid) as ok`);
    expect(row?.ok).toBe(true);
  });

  it("deletes the profile when the user is deleted", async () => {
    await db.getDb().delete(s.users).where(eq(s.users.id, BOB));
    const rows = await db.getDb().select().from(s.profiles).where(eq(s.profiles.id, BOB));
    expect(rows).toEqual([]);
  });
});
