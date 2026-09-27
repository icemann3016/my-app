import { eq, sql } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";

import { describeDb, forceListed, prepareDatabase } from "./setup";

let db: typeof import("@/lib/db");
let rls: typeof import("@/lib/db/rls");
let s: typeof import("@/lib/db/schema");

const VIC = "11aa11aa-1111-4111-8111-aaaaaaaaaaaa"; // owner
const WEN = "22bb22bb-2222-4222-8222-bbbbbbbbbbbb"; // verified pilot
const XAV = "33cc33cc-3333-4333-8333-cccccccccccc"; // someone without credentials
let aircraftId: string;
let bookingId: string;

type Args = {
  from: string;
  to: string;
  departure?: string;
  arrival?: string;
  passengers?: number;
};

/** Ask for a booking as `user`; returns the id, or the error code and detail. */
async function request(user: string, a: Args) {
  try {
    const rows = (await rls.asUser(user, (tx) =>
      tx.execute(sql`select public.request_booking(
        ${aircraftId}::uuid, ${`[${a.from},${a.to})`}::tstzrange, ${a.departure ?? "LBSF"},
        ${a.arrival ?? "LBSF"}, '{}'::text[], 'local', ${a.passengers ?? 1}, 1.5,
        'Local flight', 270) as id`),
    )) as unknown as { id: string }[];
    return { id: rows[0]!.id };
  } catch (e) {
    const err = e as { cause?: { code?: string; message?: string; detail?: string } };
    return { code: err.cause?.code, message: err.cause?.message, detail: err.cause?.detail };
  }
}

describeDb("booking requests", () => {
  beforeAll(async () => {
    await prepareDatabase();
    db = await import("@/lib/db");
    rls = await import("@/lib/db/rls");
    s = await import("@/lib/db/schema");
    const owner = db.getDb();
    await owner.insert(s.users).values([
      { id: VIC, name: "Vic", email: "vic@example.com" },
      { id: WEN, name: "Wen", email: "wen@example.com" },
      { id: XAV, name: "Xav", email: "xav@example.com" },
    ]);
    const airport = (ident: string, latitude: number, longitude: number) => ({
      ident,
      type: "medium_airport",
      name: ident,
      icaoCode: ident,
      country: "BG",
      latitude,
      longitude,
      timezone: "Europe/Sofia",
    });
    await owner
      .insert(s.airports)
      .values([airport("LBSF", 42.6952, 23.4062), airport("LBWN", 43.2321, 27.8251)]);
    const [plane] = await owner
      .insert(s.aircraft)
      .values({
        ownerId: VIC,
        registration: "LZ-VIC",
        manufacturer: "Cessna",
        model: "172",
        typeDesignator: "C172",
        seats: 4,
        fuelType: "avgas_100ll",
        homeAirportIdent: "LBSF",
        pricePerHour: 180,
      })
      .returning();
    aircraftId = plane!.id;
    await forceListed(aircraftId);
    await owner.insert(s.pilotLicences).values({
      userId: WEN,
      type: "ppl_a",
      issuingState: "BG",
      number: "1",
      status: "verified",
    });
    await owner.insert(s.medicals).values({
      userId: WEN,
      class: "class2",
      issuingState: "BG",
      validUntil: "2099-01-01",
      status: "verified",
    });
    await owner
      .insert(s.pilotRatings)
      .values({ userId: WEN, kind: "class", code: "SEP_LAND", status: "verified" });
  }, 60_000);

  it("creates a request, holds the calendar and records it", async () => {
    const result = await request(WEN, { from: "2026-12-21T09:00:00Z", to: "2026-12-21T12:00:00Z" });
    expect(result.id).toBeDefined();
    bookingId = result.id!;
    const [booking] = await rls.asUser(WEN, (tx) =>
      tx.select().from(s.bookings).where(eq(s.bookings.id, bookingId)),
    );
    expect(booking).toMatchObject({
      status: "requested",
      pilotId: WEN,
      ownerId: VIC,
      pricePerHour: 180,
      currency: "EUR",
      estimate: 270,
    });
    const holds = await db
      .getDb()
      .select()
      .from(s.calendarEntries)
      .where(eq(s.calendarEntries.bookingId, bookingId));
    expect(holds).toMatchObject([{ kind: "booking", active: true }]);
    const events = await rls.asUser(VIC, (tx) => tx.select().from(s.bookingEvents));
    expect(events.map((e) => e.type)).toEqual(["requested"]);
  });

  it("shows the booking to the pilot and owner only", async () => {
    expect(await rls.asUser(VIC, (tx) => tx.select().from(s.bookings))).toHaveLength(1);
    expect(await rls.asUser(XAV, (tx) => tx.select().from(s.bookings))).toEqual([]);
    expect(await rls.asAnon((tx) => tx.select().from(s.bookings))).toEqual([]);
    expect(await rls.asUser(XAV, (tx) => tx.select().from(s.bookingEvents))).toEqual([]);
  });

  it("never allows a double booking", async () => {
    expect(
      await request(WEN, { from: "2026-12-21T11:00:00Z", to: "2026-12-21T13:00:00Z" }),
    ).toMatchObject({ code: "23P01" });
  });

  it("checks the requirements, passengers and time", async () => {
    expect(
      await request(XAV, { from: "2026-12-22T09:00:00Z", to: "2026-12-22T10:00:00Z" }),
    ).toMatchObject({ message: "not_eligible", detail: "licence,medical,class_rating" });
    expect(
      await request(VIC, { from: "2026-12-22T09:00:00Z", to: "2026-12-22T10:00:00Z" }),
    ).toMatchObject({ message: "not_eligible" });
    expect(
      await request(WEN, {
        from: "2026-12-22T09:00:00Z",
        to: "2026-12-22T10:00:00Z",
        passengers: 4,
      }),
    ).toMatchObject({ message: "too_many_passengers", detail: "3" });
    expect(
      await request(WEN, { from: "2020-01-01T09:00:00Z", to: "2020-01-01T10:00:00Z" }),
    ).toMatchObject({ message: "period_in_past" });
    expect(
      await request(WEN, { from: "2026-12-22T09:00:00Z", to: "2026-12-22T09:10:00Z" }),
    ).toMatchObject({ message: "period_length" });
  });

  it("checks night at the flight's airfields, not the aircraft's base", async () => {
    // 21 Dec: night starts about 15:26 UTC in Sofia but about 15:09 UTC in Varna (further east).
    const evening = { from: "2026-12-21T13:00:00Z", to: "2026-12-21T15:15:00Z" };
    expect(await request(WEN, { ...evening, arrival: "LBWN" })).toMatchObject({
      message: "not_eligible",
      detail: "aircraft_no_night",
    });
    expect((await request(WEN, evening)).id).toBeDefined();
  });

  it("never lets users write bookings directly", async () => {
    expect(
      await rls
        .asUser(WEN, (tx) =>
          tx.update(s.bookings).set({ status: "accepted" }).where(eq(s.bookings.id, bookingId)),
        )
        .catch((e: { cause?: { code?: string } }) => e.cause?.code),
    ).toBe("42501");
  });

  it("expires unanswered requests and frees the time", async () => {
    await db
      .getDb()
      .update(s.bookings)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(s.bookings.id, bookingId));
    await rls.asAnon((tx) => tx.execute(sql`select public.expire_booking_requests()`));
    const [booking] = await db
      .getDb()
      .select()
      .from(s.bookings)
      .where(eq(s.bookings.id, bookingId));
    expect(booking!.status).toBe("expired");
    expect(
      (await request(WEN, { from: "2026-12-21T09:00:00Z", to: "2026-12-21T12:00:00Z" })).id,
    ).toBeDefined();
  });

  /** The owner (or someone else) answers a request; returns the new status or the error. */
  async function respond(
    user: string,
    id: string,
    decision: string,
    proposal: string | null = null,
  ) {
    try {
      const rows = (await rls.asUser(user, (tx) =>
        tx.execute(sql`select public.respond_to_booking(${id}::uuid, ${decision}, 'Note',
          ${proposal}::tstzrange) as status`),
      )) as unknown as { status: string }[];
      return rows[0]!.status;
    } catch (e) {
      return (e as { cause?: { message?: string } }).cause?.message;
    }
  }

  it("lets only the owner accept, and only while the request is open", async () => {
    const { id } = await request(WEN, { from: "2026-12-23T09:00:00Z", to: "2026-12-23T11:00:00Z" });
    expect(await respond(WEN, id!, "accept")).toBe("not_found");
    expect(await respond(XAV, id!, "accept")).toBe("not_found");
    expect(await respond(VIC, id!, "accept")).toBe("accepted");
    expect(await respond(VIC, id!, "decline")).toBe("not_open");
    const holds = await db
      .getDb()
      .select()
      .from(s.calendarEntries)
      .where(eq(s.calendarEntries.bookingId, id!));
    expect(holds[0]!.active).toBe(true);
  });

  it("frees the time when declining, and can suggest another", async () => {
    const { id } = await request(WEN, { from: "2026-12-24T09:00:00Z", to: "2026-12-24T11:00:00Z" });
    expect(await respond(VIC, id!, "decline", "[2026-12-24T12:00:00Z,2026-12-24T14:00:00Z)")).toBe(
      "declined",
    );
    const [booking] = await db.getDb().select().from(s.bookings).where(eq(s.bookings.id, id!));
    expect(booking!.proposedPeriod).toContain("2026-12-24 12:00:00");
    const [hold] = await db
      .getDb()
      .select()
      .from(s.calendarEntries)
      .where(eq(s.calendarEntries.bookingId, id!));
    expect(hold!.active).toBe(false);
    const events = await rls.asUser(WEN, (tx) =>
      tx.select().from(s.bookingEvents).where(eq(s.bookingEvents.bookingId, id!)),
    );
    expect(events.map((e) => e.type)).toEqual(["requested", "proposed"]);
  });

  it("won't accept a pilot who no longer meets the requirements", async () => {
    const { id } = await request(WEN, { from: "2026-12-26T09:00:00Z", to: "2026-12-26T11:00:00Z" });
    await db
      .getDb()
      .update(s.medicals)
      .set({ validUntil: "2026-12-01" })
      .where(eq(s.medicals.userId, WEN));
    expect(await respond(VIC, id!, "accept")).toBe("pilot_not_eligible");
    await db
      .getDb()
      .update(s.medicals)
      .set({ validUntil: "2099-01-01" })
      .where(eq(s.medicals.userId, WEN));
  });
});
