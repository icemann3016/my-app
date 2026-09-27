import { eq, sql } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";

import { describeDb, prepareDatabase } from "./setup";

let db: typeof import("@/lib/db");
let rls: typeof import("@/lib/db/rls");
let s: typeof import("@/lib/db/schema");

const OWEN = "0e0e0e0e-1111-4111-8111-111111111111"; // aircraft owner
const PIA = "0f0f0f0f-2222-4222-8222-222222222222"; // pilot, not an owner
const ADA = "0a0a0a0a-3333-4333-8333-333333333333"; // admin
let aircraftId: string;
let owenDoc: string;
let piaDoc: string;

/** Postgres error code (and detail) of a failed query (drizzle wraps the driver error). */
async function pgError(promise: Promise<unknown>) {
  try {
    await promise;
    return undefined;
  } catch (e) {
    const err = e as { code?: string; detail?: string; cause?: { code?: string; detail?: string } };
    return { code: err.cause?.code ?? err.code, detail: err.cause?.detail ?? err.detail };
  }
}
const pgCode = async (p: Promise<unknown>) => (await pgError(p))?.code;

function inDays(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const basics = {
  registration: "LZ-ABC",
  manufacturer: "Cessna",
  model: "172S Skyhawk",
  typeDesignator: "C172",
  seats: 4,
  fuelType: "avgas_100ll" as const,
};

describeDb("aircraft security", () => {
  beforeAll(async () => {
    await prepareDatabase();
    db = await import("@/lib/db");
    rls = await import("@/lib/db/rls");
    s = await import("@/lib/db/schema");
    const owner = db.getDb();
    await owner.insert(s.users).values([
      { id: OWEN, name: "Owen", email: "owen@example.com" },
      { id: PIA, name: "Pia", email: "pia@example.com" },
      { id: ADA, name: "Ada", email: "ada@example.com" },
    ]);
    await owner.insert(s.userRoles).values([
      { userId: OWEN, role: "owner" },
      { userId: PIA, role: "pilot" },
      { userId: ADA, role: "admin" },
    ]);
    await owner.insert(s.airports).values({
      ident: "LBSF",
      type: "large_airport",
      name: "Sofia Airport",
      country: "BG",
      latitude: 42.69,
      longitude: 23.41,
      timezone: "Europe/Sofia",
    });
    const doc = (user: string) =>
      rls.asUser(user, (tx) =>
        tx
          .insert(s.documents)
          .values({
            ownerId: user,
            storageKey: `documents/${user}/${crypto.randomUUID()}.pdf`,
            filename: "arc.pdf",
            contentType: "application/pdf",
            sizeBytes: 10,
          })
          .returning({ id: s.documents.id }),
      );
    owenDoc = (await doc(OWEN))[0]!.id;
    piaDoc = (await doc(PIA))[0]!.id;
  }, 60_000);

  it("only lets users with the owner role add aircraft, as drafts", async () => {
    expect(
      await pgCode(
        rls.asUser(PIA, (tx) => tx.insert(s.aircraft).values({ ...basics, ownerId: PIA })),
      ),
    ).toBe("42501");
    expect(
      await pgCode(
        rls.asUser(OWEN, (tx) =>
          tx.insert(s.aircraft).values({ ...basics, ownerId: OWEN, status: "listed" }),
        ),
      ),
    ).toBe("42501");
    expect(
      await pgCode(
        rls.asUser(OWEN, (tx) =>
          tx.insert(s.aircraft).values({ ...basics, ownerId: OWEN, ratingCount: 99 }),
        ),
      ),
    ).toBe("42501");
    const [row] = await rls.asUser(OWEN, (tx) =>
      tx
        .insert(s.aircraft)
        .values({ ...basics, ownerId: OWEN })
        .returning(),
    );
    aircraftId = row!.id;
    expect(row!.status).toBe("draft");
  });

  it("hides drafts from other users and visitors, but not from admins", async () => {
    expect(await rls.asAnon((tx) => tx.select().from(s.aircraft))).toEqual([]);
    expect(await rls.asUser(PIA, (tx) => tx.select().from(s.aircraft))).toEqual([]);
    const seen = await rls.asUser(ADA, (tx) => tx.select().from(s.aircraft));
    expect(seen.map((a) => a.id)).toEqual([aircraftId]);
  });

  it("stops other users changing or deleting an aircraft", async () => {
    const changed = await rls.asUser(PIA, (tx) =>
      tx
        .update(s.aircraft)
        .set({ model: "hacked" })
        .where(eq(s.aircraft.id, aircraftId))
        .returning(),
    );
    expect(changed).toEqual([]);
    const deleted = await rls.asUser(PIA, (tx) =>
      tx.delete(s.aircraft).where(eq(s.aircraft.id, aircraftId)).returning(),
    );
    expect(deleted).toEqual([]);
  });

  it("stops owners changing ratings, the owner or the system's unlisting reason", async () => {
    for (const set of [{ ratingAvg: 5 }, { ownerId: PIA }, { unlistedReason: null }]) {
      expect(
        await pgCode(
          rls.asUser(OWEN, (tx) =>
            tx.update(s.aircraft).set(set).where(eq(s.aircraft.id, aircraftId)),
          ),
        ),
      ).toBe("42501");
    }
  });

  it("only lets the owner add photos, in the aircraft's own storage folder", async () => {
    expect(
      await pgCode(
        rls.asUser(PIA, (tx) =>
          tx
            .insert(s.aircraftPhotos)
            .values({ aircraftId, storageKey: `aircraft/${aircraftId}/pia.jpg` }),
        ),
      ),
    ).toBe("42501");
    expect(
      await pgCode(
        rls.asUser(OWEN, (tx) =>
          tx.insert(s.aircraftPhotos).values({ aircraftId, storageKey: `avatars/${OWEN}/x.jpg` }),
        ),
      ),
    ).toBe("42501");
  });

  it("allows at most 20 photos", async () => {
    await rls.asUser(OWEN, (tx) =>
      tx.insert(s.aircraftPhotos).values(
        Array.from({ length: 20 }, (_, i) => ({
          aircraftId,
          storageKey: `aircraft/${aircraftId}/${i}.jpg`,
          sortOrder: i,
        })),
      ),
    );
    expect(
      await pgCode(
        rls.asUser(OWEN, (tx) =>
          tx
            .insert(s.aircraftPhotos)
            .values({ aircraftId, storageKey: `aircraft/${aircraftId}/21.jpg` }),
        ),
      ),
    ).toBe("23514");
    await rls.asUser(OWEN, (tx) =>
      tx.delete(s.aircraftPhotos).where(sql`${s.aircraftPhotos.sortOrder} > 0`),
    );
  });

  it("starts documents unreviewed and only with the owner's own uploads", async () => {
    expect(
      await pgCode(
        rls.asUser(OWEN, (tx) =>
          tx.insert(s.aircraftDocuments).values({
            aircraftId,
            kind: "arc",
            documentId: owenDoc,
            expiresOn: inDays(200),
            status: "verified",
          }),
        ),
      ),
    ).toBe("42501");
    expect(
      await pgCode(
        rls.asUser(OWEN, (tx) =>
          tx.insert(s.aircraftDocuments).values({
            aircraftId,
            kind: "arc",
            documentId: piaDoc,
            expiresOn: inDays(200),
            status: "pending",
          }),
        ),
      ),
    ).toBe("42501");
    const rows = await rls.asUser(OWEN, (tx) =>
      tx
        .insert(s.aircraftDocuments)
        .values([
          {
            aircraftId,
            kind: "arc",
            documentId: owenDoc,
            expiresOn: inDays(200),
            status: "pending",
          },
          {
            aircraftId,
            kind: "insurance",
            documentId: owenDoc,
            expiresOn: inDays(100),
            status: "pending",
          },
          { aircraftId, kind: "poh", documentId: owenDoc, title: "Normal procedures" },
        ])
        .returning(),
    );
    expect(rows.map((r) => r.status)).toEqual(["pending", "pending", null]);
  });

  it("keeps aircraft documents private to the owner and admins", async () => {
    expect(await rls.asUser(PIA, (tx) => tx.select().from(s.aircraftDocuments))).toEqual([]);
    expect(await rls.asAnon((tx) => tx.select().from(s.aircraftDocuments))).toEqual([]);
    expect(await rls.asUser(ADA, (tx) => tx.select().from(s.aircraftDocuments))).toHaveLength(3);
    expect(
      await pgCode(
        rls.asUser(OWEN, (tx) =>
          tx
            .update(s.aircraftDocuments)
            .set({ status: "verified" })
            .where(eq(s.aircraftDocuments.aircraftId, aircraftId)),
        ),
      ),
    ).toBe("42501");
  });

  it("lists an aircraft only when base, price, photo, ARC and insurance are in place", async () => {
    const list = () =>
      pgError(
        rls.asUser(OWEN, (tx) =>
          tx.update(s.aircraft).set({ status: "listed" }).where(eq(s.aircraft.id, aircraftId)),
        ),
      );
    expect(await list()).toEqual({
      code: "23514",
      detail: "home_base,price,arc,insurance",
    });

    await rls.asUser(OWEN, (tx) =>
      tx
        .update(s.aircraft)
        .set({ homeAirportIdent: "LBSF", pricePerHour: 180 })
        .where(eq(s.aircraft.id, aircraftId)),
    );
    // An admin verifies the ARC (trusted code, owner connection); insurance is still pending.
    await db
      .getDb()
      .update(s.aircraftDocuments)
      .set({ status: "verified", reviewedBy: ADA, reviewedAt: new Date() })
      .where(eq(s.aircraftDocuments.kind, "arc"));
    expect((await list())?.detail).toBe("insurance");

    await db
      .getDb()
      .update(s.aircraftDocuments)
      .set({ status: "verified", reviewedBy: ADA, reviewedAt: new Date() })
      .where(eq(s.aircraftDocuments.kind, "insurance"));
    expect(await list()).toBeUndefined();
  });

  it("shows listed aircraft, photos and requirements to everyone, but not documents", async () => {
    await rls.asUser(OWEN, (tx) =>
      tx.insert(s.rentalRequirements).values({ aircraftId, minTotalHours: 100 }),
    );
    expect(await rls.asAnon((tx) => tx.select().from(s.aircraft))).toHaveLength(1);
    expect(await rls.asAnon((tx) => tx.select().from(s.aircraftPhotos))).toHaveLength(1);
    expect(await rls.asUser(PIA, (tx) => tx.select().from(s.rentalRequirements))).toHaveLength(1);
    expect(await rls.asUser(PIA, (tx) => tx.select().from(s.aircraftDocuments))).toEqual([]);
    expect(
      await pgCode(
        rls.asUser(PIA, (tx) =>
          tx.insert(s.rentalRequirements).values({ aircraftId, minTotalHours: 0 }),
        ),
      ),
    ).toBe("42501");
  });

  it("sends an edited verified document back for review", async () => {
    const [row] = await rls.asUser(OWEN, (tx) =>
      tx
        .update(s.aircraftDocuments)
        .set({ expiresOn: inDays(300) })
        .where(eq(s.aircraftDocuments.kind, "arc"))
        .returning(),
    );
    expect(row!.status).toBe("pending");
    // Reference documents have no review status and keep none.
    const [poh] = await rls.asUser(OWEN, (tx) =>
      tx
        .update(s.aircraftDocuments)
        .set({ title: "Emergency procedures" })
        .where(eq(s.aircraftDocuments.kind, "poh"))
        .returning(),
    );
    expect(poh!.status).toBeNull();
  });

  it("never puts a listed aircraft back to draft, and keeps registrations unique", async () => {
    expect(
      await pgCode(
        rls.asUser(OWEN, (tx) =>
          tx.update(s.aircraft).set({ status: "draft" }).where(eq(s.aircraft.id, aircraftId)),
        ),
      ),
    ).toBe("23514");
    // A second draft with the same registration is fine; listing it is not.
    const [copy] = await rls.asUser(OWEN, (tx) =>
      tx
        .insert(s.aircraft)
        .values({ ...basics, ownerId: OWEN })
        .returning(),
    );
    expect(
      await pgCode(
        rls.asUser(OWEN, (tx) =>
          tx.update(s.aircraft).set({ status: "paused" }).where(eq(s.aircraft.id, copy!.id)),
        ),
      ),
    ).toBe("23505");
  });

  it("lets owners pause and unlist without the listing checks", async () => {
    for (const status of ["paused", "unlisted", "grounded"] as const) {
      const [row] = await rls.asUser(OWEN, (tx) =>
        tx.update(s.aircraft).set({ status }).where(eq(s.aircraft.id, aircraftId)).returning(),
      );
      expect(row!.status).toBe(status);
    }
    // The ARC is pending again after the edit above, so it can't be listed.
    expect(
      (
        await pgError(
          rls.asUser(OWEN, (tx) =>
            tx.update(s.aircraft).set({ status: "listed" }).where(eq(s.aircraft.id, aircraftId)),
          ),
        )
      )?.detail,
    ).toBe("arc");
    expect(await rls.asAnon((tx) => tx.select().from(s.aircraft))).toEqual([]);
  });

  it("removes a user's aircraft, photos and documents with the account", async () => {
    await db.getDb().delete(s.users).where(eq(s.users.id, OWEN));
    expect(await db.getDb().select().from(s.aircraft)).toEqual([]);
    expect(await db.getDb().select().from(s.aircraftDocuments)).toEqual([]);
    expect(await db.getDb().select().from(s.aircraftPhotos)).toEqual([]);
  });
});
