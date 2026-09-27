import { eq } from "drizzle-orm";
import { beforeAll, expect, it, vi } from "vitest";

import { describeDb, prepareDatabase } from "./setup";

let db: typeof import("@/lib/db");
let rls: typeof import("@/lib/db/rls");
let s: typeof import("@/lib/db/schema");
let review: typeof import("@/lib/admin/aircraft-review");
let expiry: typeof import("@/lib/aircraft/expiry");

const OWEN = "1e1e1e1e-1111-4111-8111-eeeeeeeeeeee"; // owner
const ADA = "2f2f2f2f-2222-4222-8222-ffffffffffff"; // admin
let planeId: string;

const inDays = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

describeDb("aircraft verification and daily jobs", () => {
  beforeAll(async () => {
    await prepareDatabase();
    process.env.EMAIL_DRIVER = "console";
    db = await import("@/lib/db");
    rls = await import("@/lib/db/rls");
    s = await import("@/lib/db/schema");
    review = await import("@/lib/admin/aircraft-review");
    expiry = await import("@/lib/aircraft/expiry");
    await db
      .getDb()
      .insert(s.users)
      .values([
        { id: OWEN, name: "Owen", email: "owen-j@example.com" },
        { id: ADA, name: "Ada", email: "ada-j@example.com" },
      ]);
    await db
      .getDb()
      .insert(s.userRoles)
      .values([
        { userId: OWEN, role: "owner" },
        { userId: ADA, role: "admin" },
      ]);
    await db
      .getDb()
      .insert(s.airports)
      .values({
        ident: "LBPD",
        type: "medium_airport",
        name: "Plovdiv Airport",
        country: "BG",
        latitude: 42.07,
        longitude: 24.85,
        timezone: "Europe/Sofia",
      })
      .onConflictDoNothing();

    const [plane] = await rls.asUser(OWEN, (tx) =>
      tx
        .insert(s.aircraft)
        .values({
          ownerId: OWEN,
          registration: "LZ-JOB",
          manufacturer: "Piper",
          model: "PA-28-181 Archer",
          icaoType: "P28A",
          seats: 4,
          fuelType: "avgas_100ll",
          homeAirportIdent: "LBPD",
          pricePerHour: 150,
        })
        .returning(),
    );
    planeId = plane!.id;
    await rls.asUser(OWEN, (tx) =>
      tx
        .insert(s.aircraftPhotos)
        .values({ aircraftId: planeId, storageKey: `aircraft/${planeId}/1.jpg` }),
    );
    await rls.asUser(OWEN, (tx) =>
      tx.insert(s.aircraftDocuments).values([
        { aircraftId: planeId, kind: "cofa" },
        { aircraftId: planeId, kind: "arc", expiresOn: inDays(20) },
        { aircraftId: planeId, kind: "insurance", expiresOn: inDays(200) },
      ]),
    );
    // The owner asked to publish; it waits for the document check.
    await rls.asUser(OWEN, (tx) =>
      tx
        .update(s.aircraft)
        .set({ publishRequestedAt: new Date() })
        .where(eq(s.aircraft.id, planeId)),
    );
  }, 60_000);

  it("queues the aircraft and publishes it after the last document is verified", async () => {
    const queue = await review.getAircraftQueue(ADA);
    expect(queue).toMatchObject([{ aircraftId: planeId, registration: "LZ-JOB", items: 3 }]);

    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const docs = await db
      .getDb()
      .select()
      .from(s.aircraftDocuments)
      .where(eq(s.aircraftDocuments.aircraftId, planeId));
    const results = [];
    for (const d of docs) {
      results.push(
        await review.reviewAircraftDocument({
          adminId: ADA,
          id: d.id,
          version: d.updatedAt.toISOString(),
          decision: "verify",
          reason: null,
        }),
      );
    }
    info.mockRestore();
    expect(results.map((r) => r.ok && r.listed)).toEqual([false, false, true]);
    const [plane] = await db.getDb().select().from(s.aircraft).where(eq(s.aircraft.id, planeId));
    expect(plane).toMatchObject({ status: "listed", publishRequestedAt: null });
  });

  it("doesn't let an admin verify documents of their own aircraft", async () => {
    await db.getDb().insert(s.userRoles).values({ userId: ADA, role: "owner" });
    const [own] = await rls.asUser(ADA, (tx) =>
      tx.insert(s.aircraft).values({ ownerId: ADA, registration: "LZ-ADA" }).returning(),
    );
    const [doc] = await rls.asUser(ADA, (tx) =>
      tx.insert(s.aircraftDocuments).values({ aircraftId: own!.id, kind: "cofa" }).returning(),
    );
    expect(
      await review.reviewAircraftDocument({
        adminId: ADA,
        id: doc!.id,
        version: doc!.updatedAt.toISOString(),
        decision: "verify",
        reason: null,
      }),
    ).toEqual({ ok: false, error: "ownItem" });
  });

  it("reminds the owner once when the ARC expires within 30 days", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    expect(await expiry.sendAircraftExpiryReminders()).toEqual({
      emails: 1,
      items: 1,
      notDelivered: 0,
    });
    expect(info.mock.calls.flat().join("\n")).toContain("LZ-JOB, Airworthiness Review Certificate");
    expect(await expiry.sendAircraftExpiryReminders()).toMatchObject({ emails: 0, items: 0 });
    info.mockRestore();
  });

  it("unlists the aircraft when the ARC has expired, and only then", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    expect(await expiry.unlistExpiredAircraft()).toEqual({ unlisted: 0 });
    await db
      .getDb()
      .update(s.aircraftDocuments)
      .set({ expiresOn: inDays(-1) })
      .where(eq(s.aircraftDocuments.kind, "arc"));
    expect(await expiry.unlistExpiredAircraft()).toEqual({ unlisted: 1 });
    info.mockRestore();
    const [plane] = await db.getDb().select().from(s.aircraft).where(eq(s.aircraft.id, planeId));
    expect(plane).toMatchObject({ status: "unlisted", statusReason: "documents_expired" });
    // Visitors don't see it any more.
    expect(
      await rls.asAnon((tx) => tx.select().from(s.aircraft).where(eq(s.aircraft.id, planeId))),
    ).toEqual([]);
  });
});
