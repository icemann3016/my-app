import { eq, sql } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";

import { describeDb, prepareDatabase } from "./setup";

let db: typeof import("@/lib/db");
let rls: typeof import("@/lib/db/rls");
let s: typeof import("@/lib/db/schema");

const OLGA = "0a0a0a0a-1111-4111-8111-aaaaaaaaaaaa"; // owner
const PETE = "0b0b0b0b-2222-4222-8222-bbbbbbbbbbbb"; // pilot, not an owner
const QUIN = "0c0c0c0c-3333-4333-8333-cccccccccccc"; // admin
const ROSA = "0d0d0d0d-4444-4444-8444-dddddddddddd"; // another owner
let aircraftId: string;

type PgError = { code?: string; hint?: string };
async function pgError(promise: Promise<unknown>): Promise<PgError | undefined> {
  try {
    await promise;
    return undefined;
  } catch (e) {
    const err = e as PgError & { cause?: PgError };
    return { code: err.cause?.code ?? err.code, hint: err.cause?.hint ?? err.hint };
  }
}

const inDays = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

describeDb("aircraft listings security", () => {
  beforeAll(async () => {
    await prepareDatabase();
    db = await import("@/lib/db");
    rls = await import("@/lib/db/rls");
    s = await import("@/lib/db/schema");
    await db
      .getDb()
      .insert(s.users)
      .values([
        { id: OLGA, name: "Olga", email: "olga-a@example.com" },
        { id: PETE, name: "Pete", email: "pete-a@example.com" },
        { id: QUIN, name: "Quin", email: "quin-a@example.com" },
        { id: ROSA, name: "Rosa", email: "rosa-a@example.com" },
      ]);
    await db
      .getDb()
      .insert(s.userRoles)
      .values([
        { userId: OLGA, role: "owner" },
        { userId: ROSA, role: "owner" },
        { userId: QUIN, role: "admin" },
      ]);
    await db
      .getDb()
      .insert(s.airports)
      .values({
        ident: "LBSF",
        type: "large_airport",
        name: "Sofia Airport",
        country: "BG",
        latitude: 42.69,
        longitude: 23.41,
        timezone: "Europe/Sofia",
      })
      .onConflictDoNothing();
  }, 60_000);

  it("lets owners create drafts, but not other users", async () => {
    expect(
      (
        await pgError(
          rls.asUser(PETE, (tx) =>
            tx.insert(s.aircraft).values({ ownerId: PETE, registration: "LZ-PET" }),
          ),
        )
      )?.code,
    ).toBe("42501");
    const [row] = await rls.asUser(OLGA, (tx) =>
      tx.insert(s.aircraft).values({ ownerId: OLGA, registration: "LZ-ABC" }).returning(),
    );
    aircraftId = row!.id;
    expect(row!.status).toBe("draft");
    // Can't start out listed.
    expect(
      (
        await pgError(
          rls.asUser(OLGA, (tx) =>
            tx
              .insert(s.aircraft)
              .values({ ownerId: OLGA, registration: "LZ-XYZ", status: "listed" }),
          ),
        )
      )?.hint,
    ).toBe("not_listable");
  });

  it("keeps drafts private to the owner and admins", async () => {
    expect(await rls.asAnon((tx) => tx.select().from(s.aircraft))).toEqual([]);
    expect(await rls.asUser(PETE, (tx) => tx.select().from(s.aircraft))).toEqual([]);
    expect(await rls.asUser(OLGA, (tx) => tx.select().from(s.aircraft))).toHaveLength(1);
    expect(await rls.asUser(QUIN, (tx) => tx.select().from(s.aircraft))).toHaveLength(1);
    const hijack = await rls.asUser(ROSA, (tx) =>
      tx
        .update(s.aircraft)
        .set({ model: "hacked" })
        .where(eq(s.aircraft.id, aircraftId))
        .returning(),
    );
    expect(hijack).toEqual([]);
  });

  it("refuses to list an incomplete aircraft and says what's missing", async () => {
    const err = await pgError(
      rls.asUser(OLGA, (tx) =>
        tx.update(s.aircraft).set({ status: "listed" }).where(eq(s.aircraft.id, aircraftId)),
      ),
    );
    expect(err).toEqual({ code: "P0001", hint: "not_listable" });
    const [row] = (await rls.asUser(OLGA, (tx) =>
      tx.execute(
        sql`select public.aircraft_listing_problems(a) as problems from aircraft a where id = ${aircraftId}`,
      ),
    )) as unknown as { problems: string[] }[];
    expect(row!.problems).toEqual([
      "manufacturer",
      "model",
      "icao_type",
      "seats",
      "fuel_type",
      "home_airport",
      "price",
      "photo",
      "cofa",
      "arc",
      "insurance",
    ]);
  });

  it("only takes photos in the aircraft's own storage folder, at most 20", async () => {
    expect(
      (
        await pgError(
          rls.asUser(OLGA, (tx) =>
            tx
              .insert(s.aircraftPhotos)
              .values({ aircraftId, storageKey: `aircraft/someone-else/x.jpg` }),
          ),
        )
      )?.code,
    ).toBe("42501");
    await rls.asUser(OLGA, (tx) =>
      tx.insert(s.aircraftPhotos).values(
        Array.from({ length: 20 }, (_, i) => ({
          aircraftId,
          storageKey: `aircraft/${aircraftId}/${i}.jpg`,
          sortOrder: i,
        })),
      ),
    );
    expect(
      await pgError(
        rls.asUser(OLGA, (tx) =>
          tx
            .insert(s.aircraftPhotos)
            .values({ aircraftId, storageKey: `aircraft/${aircraftId}/21.jpg` }),
        ),
      ),
    ).toEqual({ code: "P0001", hint: "too_many_photos" });
  });

  it("starts documents as pending and doesn't let owners verify them", async () => {
    const docs = await rls.asUser(OLGA, (tx) =>
      tx
        .insert(s.aircraftDocuments)
        .values([
          { aircraftId, kind: "cofa" },
          { aircraftId, kind: "arc", expiresOn: inDays(200) },
          { aircraftId, kind: "insurance", expiresOn: inDays(100) },
        ])
        .returning(),
    );
    expect(docs.map((d) => d.status)).toEqual(["pending", "pending", "pending"]);
    expect(
      (
        await pgError(
          rls.asUser(OLGA, (tx) =>
            tx
              .update(s.aircraftDocuments)
              .set({ status: "verified" })
              .where(eq(s.aircraftDocuments.aircraftId, aircraftId)),
          ),
        )
      )?.code,
    ).toBe("42501");
    expect(await rls.asUser(PETE, (tx) => tx.select().from(s.aircraftDocuments))).toEqual([]);
  });

  it("lists a complete aircraft once an admin verified its documents", async () => {
    await rls.asUser(OLGA, (tx) =>
      tx
        .update(s.aircraft)
        .set({
          manufacturer: "Cessna",
          model: "172S Skyhawk",
          icaoType: "C172",
          seats: 4,
          fuelType: "avgas_100ll",
          homeAirportIdent: "LBSF",
          pricePerHour: 180,
        })
        .where(eq(s.aircraft.id, aircraftId)),
    );
    await rls.asUser(OLGA, (tx) =>
      tx.insert(s.rentalRequirements).values({ aircraftId, minTotalHours: 100 }),
    );
    // Trusted admin code verifies with the owner connection.
    await db
      .getDb()
      .update(s.aircraftDocuments)
      .set({ status: "verified", reviewedBy: QUIN, reviewedAt: new Date() })
      .where(eq(s.aircraftDocuments.aircraftId, aircraftId));
    const [listed] = await rls.asUser(OLGA, (tx) =>
      tx
        .update(s.aircraft)
        .set({ status: "listed" })
        .where(eq(s.aircraft.id, aircraftId))
        .returning(),
    );
    expect(listed!.status).toBe("listed");
    expect(listed!.listedAt).not.toBeNull();

    // Visitors now see the aircraft, its photos and requirements, but never its documents.
    expect(await rls.asAnon((tx) => tx.select().from(s.aircraft))).toHaveLength(1);
    expect(await rls.asAnon((tx) => tx.select().from(s.aircraftPhotos))).toHaveLength(20);
    expect(await rls.asAnon((tx) => tx.select().from(s.rentalRequirements))).toHaveLength(1);
    expect(await rls.asAnon((tx) => tx.select().from(s.aircraftDocuments))).toEqual([]);
    expect(await rls.asUser(PETE, (tx) => tx.select().from(s.aircraftFiles))).toEqual([]);
  });

  it("locks the registration after publishing and allows one live listing per registration", async () => {
    expect(
      await pgError(
        rls.asUser(OLGA, (tx) =>
          tx
            .update(s.aircraft)
            .set({ registration: "LZ-NEW" })
            .where(eq(s.aircraft.id, aircraftId)),
        ),
      ),
    ).toEqual({ code: "P0001", hint: "registration_locked" });

    // Another owner can draft the same registration, but can't take it live.
    const [copy] = await rls.asUser(ROSA, (tx) =>
      tx.insert(s.aircraft).values({ ownerId: ROSA, registration: "LZ-ABC" }).returning(),
    );
    const err = await pgError(
      db.getDb().update(s.aircraft).set({ status: "paused" }).where(eq(s.aircraft.id, copy!.id)),
    );
    expect(err?.code).toBe("23505");
  });

  it("keeps a system reason only until the status changes again", async () => {
    await db
      .getDb()
      .update(s.aircraft)
      .set({ status: "unlisted", statusReason: "documents_expired" })
      .where(eq(s.aircraft.id, aircraftId));
    const [paused] = await rls.asUser(OLGA, (tx) =>
      tx
        .update(s.aircraft)
        .set({ status: "paused" })
        .where(eq(s.aircraft.id, aircraftId))
        .returning(),
    );
    expect(paused).toMatchObject({ status: "paused", statusReason: null });
  });

  it("treats an expired ARC as a reason not to list", async () => {
    await db
      .getDb()
      .update(s.aircraftDocuments)
      .set({ expiresOn: inDays(-1) })
      .where(eq(s.aircraftDocuments.kind, "arc"));
    const err = await pgError(
      rls.asUser(OLGA, (tx) =>
        tx.update(s.aircraft).set({ status: "listed" }).where(eq(s.aircraft.id, aircraftId)),
      ),
    );
    expect(err?.hint).toBe("not_listable");
  });

  it("lets owners delete drafts and paused aircraft, not other people's", async () => {
    expect(
      await rls.asUser(ROSA, (tx) =>
        tx.delete(s.aircraft).where(eq(s.aircraft.id, aircraftId)).returning(),
      ),
    ).toEqual([]);
    const deleted = await rls.asUser(OLGA, (tx) =>
      tx.delete(s.aircraft).where(eq(s.aircraft.id, aircraftId)).returning(),
    );
    expect(deleted).toHaveLength(1);
    expect(
      await db
        .getDb()
        .select()
        .from(s.aircraftPhotos)
        .where(eq(s.aircraftPhotos.aircraftId, aircraftId)),
    ).toEqual([]);
  });
});
