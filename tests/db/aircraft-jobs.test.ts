import { eq } from "drizzle-orm";
import { beforeAll, expect, it, vi } from "vitest";

import { describeDb, prepareDatabase } from "./setup";

let db: typeof import("@/lib/db");
let s: typeof import("@/lib/db/schema");
let adminAircraft: typeof import("@/lib/admin/aircraft");
let expiry: typeof import("@/lib/aircraft/expiry");
let docs: typeof import("@/lib/documents");

const IVA = "1a1a1a1a-4444-4444-8444-444444444444"; // owner
const JON = "2b2b2b2b-5555-4555-8555-555555555555"; // admin
let aircraftId: string;
let arcId: string;
let insuranceId: string;
let fileId: string;

const inDays = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

describeDb("aircraft document review and daily job", () => {
  beforeAll(async () => {
    await prepareDatabase();
    process.env.EMAIL_DRIVER = "console";
    db = await import("@/lib/db");
    s = await import("@/lib/db/schema");
    adminAircraft = await import("@/lib/admin/aircraft");
    expiry = await import("@/lib/aircraft/expiry");
    docs = await import("@/lib/documents");
    const owner = db.getDb();
    await owner.insert(s.users).values([
      { id: IVA, name: "Iva", email: "iva@example.com" },
      { id: JON, name: "Jon", email: "jon@example.com" },
    ]);
    await owner.insert(s.userRoles).values([
      { userId: IVA, role: "owner" },
      { userId: JON, role: "admin" },
    ]);
    await owner.insert(s.airports).values({
      ident: "LBPD",
      type: "medium_airport",
      name: "Plovdiv Airport",
      country: "BG",
      latitude: 42.07,
      longitude: 24.85,
      timezone: "Europe/Sofia",
    });
    const [plane] = await owner
      .insert(s.aircraft)
      .values({
        ownerId: IVA,
        registration: "LZ-IVA",
        manufacturer: "Piper",
        model: "PA-28-181 Archer",
        typeDesignator: "P28A",
        seats: 4,
        fuelType: "avgas_100ll",
        homeAirportIdent: "LBPD",
        pricePerHour: 160,
      })
      .returning();
    aircraftId = plane!.id;
    await owner
      .insert(s.aircraftPhotos)
      .values({ aircraftId, storageKey: `aircraft/${aircraftId}/1.jpg` });
    const [file] = await owner
      .insert(s.documents)
      .values({
        ownerId: IVA,
        storageKey: `documents/${IVA}/arc.pdf`,
        filename: "arc.pdf",
        contentType: "application/pdf",
        sizeBytes: 10,
        // Old enough to be cleaned up if nothing used it.
        createdAt: new Date(Date.now() - 3 * 86_400_000),
      })
      .returning();
    fileId = file!.id;
    const rows = await owner
      .insert(s.aircraftDocuments)
      .values([
        { aircraftId, kind: "arc", documentId: fileId, expiresOn: inDays(20), status: "pending" },
        {
          aircraftId,
          kind: "insurance",
          documentId: fileId,
          expiresOn: inDays(200),
          status: "pending",
        },
      ])
      .returning();
    arcId = rows[0]!.id;
    insuranceId = rows[1]!.id;
  }, 60_000);

  it("queues pending documents and lets an admin verify them", async () => {
    expect(await adminAircraft.getAircraftQueue(JON)).toMatchObject([
      { aircraftId, registration: "LZ-IVA", ownerName: "Iva", items: 2 },
    ]);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    for (const id of [arcId, insuranceId]) {
      const [row] = await db
        .getDb()
        .select()
        .from(s.aircraftDocuments)
        .where(eq(s.aircraftDocuments.id, id));
      const result = await adminAircraft.reviewAircraftDocument({
        adminId: JON,
        id,
        version: row!.updatedAt.toISOString(),
        decision: "verify",
        reason: null,
      });
      expect(result).toEqual({ ok: true, aircraftId });
    }
    expect(info.mock.calls.flat().join("\n")).toContain("LZ-IVA: your Airworthiness Review");
    info.mockRestore();
    expect(await adminAircraft.getAircraftQueue(JON)).toEqual([]);
  });

  it("stops owners reviewing their own aircraft and stale reviews", async () => {
    const [row] = await db
      .getDb()
      .select()
      .from(s.aircraftDocuments)
      .where(eq(s.aircraftDocuments.id, arcId));
    await db.getDb().insert(s.userRoles).values({ userId: IVA, role: "admin" });
    expect(
      await adminAircraft.reviewAircraftDocument({
        adminId: IVA,
        id: arcId,
        version: row!.updatedAt.toISOString(),
        decision: "reject",
        reason: "x",
      }),
    ).toEqual({ ok: false, error: "ownItem" });
    await db.getDb().delete(s.userRoles).where(eq(s.userRoles.role, "admin"));
    await db.getDb().insert(s.userRoles).values({ userId: JON, role: "admin" });
    expect(
      await adminAircraft.reviewAircraftDocument({
        adminId: JON,
        id: arcId,
        version: "2000-01-01T00:00:00.000Z",
        decision: "reject",
        reason: "x",
      }),
    ).toEqual({ ok: false, error: "changed" });
  });

  it("reminds the owner once, 30 days before a document expires", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    expect(await expiry.sendAircraftExpiryReminders()).toEqual({
      emails: 1,
      items: 1,
      notDelivered: 0,
    });
    expect(info.mock.calls.flat().join("\n")).toContain("LZ-IVA, Airworthiness Review Certificate");
    expect(await expiry.sendAircraftExpiryReminders()).toEqual({
      emails: 0,
      items: 0,
      notDelivered: 0,
    });
    info.mockRestore();
  });

  it("keeps a listed aircraft listed while its documents are valid", async () => {
    await db
      .getDb()
      .update(s.aircraft)
      .set({ status: "listed" })
      .where(eq(s.aircraft.id, aircraftId));
    expect(await expiry.unlistExpiredAircraft()).toBe(0);
  });

  it("unlists the aircraft when its ARC expires, and tells the owner", async () => {
    await db
      .getDb()
      .update(s.aircraftDocuments)
      .set({ expiresOn: inDays(-1) })
      .where(eq(s.aircraftDocuments.id, arcId));
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    expect(await expiry.unlistExpiredAircraft()).toBe(1);
    expect(info.mock.calls.flat().join("\n")).toContain("LZ-IVA is no longer listed");
    info.mockRestore();
    const [plane] = await db.getDb().select().from(s.aircraft).where(eq(s.aircraft.id, aircraftId));
    expect(plane).toMatchObject({ status: "unlisted", unlistedReason: "arc" });
  });

  it("never cleans up uploads that an aircraft uses", async () => {
    await docs.deleteOrphanDocuments(new Date());
    const [file] = await db.getDb().select().from(s.documents).where(eq(s.documents.id, fileId));
    expect(file).toBeDefined();
  });
});
