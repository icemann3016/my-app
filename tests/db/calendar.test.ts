import { eq, sql } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";

import { describeDb, forceListed, prepareDatabase } from "./setup";

let db: typeof import("@/lib/db");
let rls: typeof import("@/lib/db/rls");
let s: typeof import("@/lib/db/schema");

const KAI = "3c3c3c3c-6666-4666-8666-666666666666"; // owner
const LEA = "4d4d4d4d-7777-4777-8777-777777777777"; // another user
let aircraftId: string;

const range = (from: string, to: string) => `[${from},${to})`;

async function pgCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    return err.cause?.code ?? err.code;
  }
}

describeDb("aircraft calendar", () => {
  beforeAll(async () => {
    await prepareDatabase();
    db = await import("@/lib/db");
    rls = await import("@/lib/db/rls");
    s = await import("@/lib/db/schema");
    const owner = db.getDb();
    await owner.insert(s.users).values([
      { id: KAI, name: "Kai", email: "kai@example.com" },
      { id: LEA, name: "Lea", email: "lea@example.com" },
    ]);
    const [plane] = await owner
      .insert(s.aircraft)
      .values({
        ownerId: KAI,
        registration: "LZ-KAI",
        manufacturer: "Diamond",
        model: "DA40",
        typeDesignator: "DA40",
        seats: 4,
        fuelType: "avgas_100ll",
      })
      .returning();
    aircraftId = plane!.id;
  }, 60_000);

  const block = (from: string, to: string, kind: "owner_use" | "maintenance" = "owner_use") =>
    rls.asUser(KAI, (tx) =>
      tx
        .insert(s.calendarEntries)
        .values({ aircraftId, kind, period: range(from, to) })
        .returning(),
    );

  it("lets the owner block time, and records who did", async () => {
    const [row] = await block("2026-10-01T08:00:00Z", "2026-10-01T12:00:00Z");
    expect(row).toMatchObject({ kind: "owner_use", active: true, createdBy: KAI });
  });

  it("never lets two active entries overlap", async () => {
    expect(await pgCode(block("2026-10-01T11:00:00Z", "2026-10-01T13:00:00Z", "maintenance"))).toBe(
      "23P01",
    );
    // Back to back is fine: the end of one period isn't part of it.
    await block("2026-10-01T12:00:00Z", "2026-10-01T14:00:00Z");
    // Inactive entries (a released hold) don't block. Written by trusted code.
    await db
      .getDb()
      .insert(s.calendarEntries)
      .values({
        aircraftId,
        kind: "maintenance",
        period: range("2026-10-01T09:00:00Z", "2026-10-01T10:00:00Z"),
        active: false,
      });
  });

  it("rejects empty or open-ended periods", async () => {
    expect(await pgCode(block("2026-10-02T10:00:00Z", "2026-10-02T10:00:00Z"))).toBe("23514");
    expect(
      await pgCode(
        rls.asUser(KAI, (tx) =>
          tx.insert(s.calendarEntries).values({
            aircraftId,
            kind: "owner_use",
            period: "[2026-10-02T10:00:00Z,)",
          }),
        ),
      ),
    ).toBe("23514");
  });

  it("keeps booking entries for the booking functions", async () => {
    expect(
      await pgCode(
        rls.asUser(KAI, (tx) =>
          tx.insert(s.calendarEntries).values({
            aircraftId,
            kind: "booking",
            bookingId: crypto.randomUUID(),
            period: range("2026-10-05T08:00:00Z", "2026-10-05T10:00:00Z"),
          }),
        ),
      ),
    ).toBe("42501");
  });

  it("hides the calendar from other users and visitors", async () => {
    expect(await rls.asUser(LEA, (tx) => tx.select().from(s.calendarEntries))).toEqual([]);
    expect(await rls.asAnon((tx) => tx.select().from(s.calendarEntries))).toEqual([]);
    expect(
      await pgCode(
        rls.asUser(LEA, (tx) =>
          tx.insert(s.calendarEntries).values({
            aircraftId,
            kind: "owner_use",
            period: range("2026-11-01T08:00:00Z", "2026-11-01T09:00:00Z"),
          }),
        ),
      ),
    ).toBe("42501");
    const deleted = await rls.asUser(LEA, (tx) => tx.delete(s.calendarEntries).returning());
    expect(deleted).toEqual([]);
  });

  const busy = (viewer: string | null) => {
    const query = (tx: import("@/lib/db").Tx) =>
      tx.execute(
        sql`select period::text from public.aircraft_busy_periods(${aircraftId}::uuid,
          '[2026-10-01T00:00:00Z,2026-10-02T00:00:00Z)'::tstzrange)`,
      ) as unknown as Promise<{ period: string }[]>;
    return viewer ? rls.asUser(viewer, query) : rls.asAnon(query);
  };
  const free = (from: string, to: string) =>
    rls
      .asAnon(
        (tx) =>
          tx.execute(
            sql`select public.aircraft_is_free(${aircraftId}::uuid, ${range(from, to)}::tstzrange) as free`,
          ) as unknown as Promise<{ free: boolean }[]>,
      )
      .then((r) => r[0]!.free);

  it("shows busy times of listed aircraft only, without notes or kinds", async () => {
    expect(await busy(null)).toEqual([]); // draft: hidden
    expect(await busy(KAI)).toHaveLength(2); // the owner sees their own
    await forceListed(aircraftId);
    const rows = await busy(null);
    expect(rows.map((r) => Object.keys(r))).toEqual([["period"], ["period"]]);
    expect(await free("2026-10-01T14:00:00Z", "2026-10-01T16:00:00Z")).toBe(true);
    expect(await free("2026-10-01T13:00:00Z", "2026-10-01T15:00:00Z")).toBe(false);
  });

  it("lets the owner remove a block", async () => {
    const removed = await rls.asUser(KAI, (tx) =>
      tx.delete(s.calendarEntries).where(eq(s.calendarEntries.kind, "owner_use")).returning(),
    );
    expect(removed).toHaveLength(2);
  });
});
