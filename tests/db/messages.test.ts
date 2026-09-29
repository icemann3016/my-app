import { sql } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";

import { describeDb, forceListed, prepareDatabase } from "./setup";

let db: typeof import("@/lib/db");
let rls: typeof import("@/lib/db/rls");
let s: typeof import("@/lib/db/schema");

const OWN = "e1e1e1e1-1111-4111-8111-e1e1e1e1e1e1"; // owner
const PIL = "e2e2e2e2-2222-4222-8222-e2e2e2e2e2e2"; // pilot with a booking
const OTH = "e3e3e3e3-3333-4333-8333-e3e3e3e3e3e3"; // someone else
let planeId: string;
let bookingId: string;

const at = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

async function verifiedPilot(userId: string) {
  const owner = db.getDb();
  await owner.insert(s.pilotLicences).values({
    userId,
    type: "ppl_a",
    issuingState: "BG",
    number: userId.slice(0, 4),
    status: "verified",
  });
  await owner.insert(s.medicals).values({
    userId,
    class: "class2",
    issuingState: "BG",
    validUntil: "2099-01-01",
    status: "verified",
  });
  await owner.insert(s.pilotRatings).values([
    { userId, kind: "class", code: "SEP_LAND", status: "verified" },
    { userId, kind: "privilege", code: "NIGHT", status: "verified" },
  ]);
}

async function request(userId: string, from: number, to: number) {
  const [row] = (await rls.asUser(userId, (tx) =>
    tx.execute(sql`select public.request_booking(${planeId}::uuid,
      tstzrange(${at(from)}::timestamptz, ${at(to)}::timestamptz), 'LBSF', 'LBSF', '{}'::text[],
      'local', 0, 1.5, null, 270) as id`),
  )) as unknown as { id: string }[];
  return row!.id;
}

async function call<T>(user: string, query: ReturnType<typeof sql>) {
  try {
    return (await rls.asUser(user, (tx) => tx.execute(query))) as unknown as T[];
  } catch (e) {
    const err = e as { cause?: { code?: string; message?: string } };
    return { error: err.cause?.code === "P0001" ? err.cause.message : err.cause?.code };
  }
}

const start = (user: string, booking: string | null, body: string | null) =>
  call<{ id: string }>(
    user,
    sql`select public.start_conversation(${planeId}::uuid, ${booking}::uuid, ${body}) as id`,
  );

const send = (user: string, conversation: string, body: string) =>
  call(user, sql`select public.send_message(${conversation}::uuid, ${body})`);

const bodies = (user: string) =>
  rls
    .asUser(user, (tx) => tx.select().from(s.messages).orderBy(s.messages.createdAt))
    .then((rows) => rows.map((m) => m.body));

let enquiry: string;
let bookingThread: string;

describeDb("messages", () => {
  beforeAll(async () => {
    await prepareDatabase();
    db = await import("@/lib/db");
    rls = await import("@/lib/db/rls");
    s = await import("@/lib/db/schema");
    const owner = db.getDb();
    await owner.insert(s.users).values([
      { id: OWN, name: "Own", email: "own-m@example.com" },
      { id: PIL, name: "Pil", email: "pil-m@example.com" },
      { id: OTH, name: "Oth", email: "oth-m@example.com" },
    ]);
    await owner.insert(s.airports).values({
      ident: "LBSF",
      type: "large_airport",
      name: "Sofia",
      country: "BG",
      latitude: 42.6952,
      longitude: 23.4062,
      timezone: "Europe/Sofia",
    });
    const [plane] = await owner
      .insert(s.aircraft)
      .values({
        ownerId: OWN,
        registration: "LZ-MSG",
        manufacturer: "Cessna",
        model: "172",
        typeDesignator: "C172",
        seats: 4,
        fuelType: "avgas_100ll",
        homeAirportIdent: "LBSF",
        pricePerHour: 180,
        nightVfr: true,
      })
      .returning();
    planeId = plane!.id;
    await forceListed(planeId);
    await verifiedPilot(PIL);
    bookingId = await request(PIL, 60 * 24 * 3, 60 * 24 * 3 + 120);
  }, 60_000);

  it("lets anyone but the owner ask about a listed aircraft, in one thread each", async () => {
    expect(await start(OWN, null, "Hi")).toEqual({ error: "not_found" });
    const [first] = (await start(OTH, null, "Is it free on Saturday?")) as { id: string }[];
    const [again] = (await start(OTH, null, "And Sunday?")) as { id: string }[];
    enquiry = first!.id;
    expect(again!.id).toBe(enquiry);
    expect(await start(OTH, null, "  ")).toEqual({ error: "body_required" });
  });

  it("opens one conversation per booking, only for its pilot and owner", async () => {
    expect(await start(OTH, bookingId, "Hi")).toEqual({ error: "not_found" });
    const [a] = (await start(PIL, bookingId, "Where are the keys?")) as { id: string }[];
    const [b] = (await start(OWN, bookingId, null)) as { id: string }[];
    bookingThread = a!.id;
    expect(b!.id).toBe(bookingThread);
    expect(await send(OWN, bookingThread, "In the club house.")).toHaveLength(1);
    expect(await send(OTH, bookingThread, "Hello?")).toEqual({ error: "not_found" });
  });

  it("shows messages only to the two participants", async () => {
    expect(await bodies(OWN)).toEqual([
      "Is it free on Saturday?",
      "And Sunday?",
      "Where are the keys?",
      "In the club house.",
    ]);
    expect(await bodies(PIL)).toEqual(["Where are the keys?", "In the club house."]);
    expect(await bodies(OTH)).toEqual(["Is it free on Saturday?", "And Sunday?"]);
    expect(await rls.asAnon((tx) => tx.select().from(s.messages))).toEqual([]);
    const threads = await rls.asUser(PIL, (tx) => tx.select().from(s.conversations));
    expect(threads.map((c) => c.id)).toEqual([bookingThread]);
  });

  it("can't be written or changed directly", async () => {
    const code = (p: Promise<unknown>) =>
      p.then(
        () => undefined,
        (e: { cause?: { code?: string } }) => e.cause?.code,
      );
    expect(
      await code(
        rls.asUser(PIL, (tx) =>
          tx.insert(s.messages).values({ conversationId: enquiry, senderId: PIL, body: "Hi" }),
        ),
      ),
    ).toBe("42501");
    expect(
      await code(rls.asUser(PIL, (tx) => tx.update(s.messages).set({ body: "Changed" }))),
    ).toBe("42501");
  });

  it("keeps read markers per side", async () => {
    const [c] = await db
      .getDb()
      .select()
      .from(s.conversations)
      .where(sql`id = ${bookingThread}::uuid`);
    // Sending marks the thread read for the sender only.
    expect(c!.ownerReadAt).not.toBeNull();
    expect(c!.pilotReadAt!.getTime()).toBeLessThan(c!.lastMessageAt.getTime());
    await rls.asUser(PIL, (tx) =>
      tx.execute(sql`select public.mark_conversation_read(${bookingThread}::uuid)`),
    );
    const [after] = await db
      .getDb()
      .select()
      .from(s.conversations)
      .where(sql`id = ${bookingThread}::uuid`);
    expect(after!.pilotReadAt!.getTime()).toBeGreaterThanOrEqual(after!.lastMessageAt.getTime());
  });

  it("lets participants report a message", async () => {
    const [m] = await rls.asUser(OWN, (tx) => tx.select().from(s.messages).limit(1));
    const report = (user: string) =>
      rls
        .asUser(user, (tx) =>
          tx.insert(s.reports).values({
            reporterId: user,
            targetType: "message",
            targetId: m!.id,
            reason: "abuse",
          }),
        )
        .then(
          () => "ok",
          (e: { cause?: { code?: string } }) => e.cause?.code,
        );
    expect(await report(PIL)).toBe(m!.conversationId === bookingThread ? "ok" : "42501");
    expect(await report(OWN)).toBe("ok");
  });

  it("emails each side once per unread streak", async () => {
    const { deliverMessageEmails } = await import("@/lib/messages/emails");
    const log = console.info;
    console.info = () => {};
    try {
      // Only the owner has unread messages (the enquiry); the pilot read the booking thread.
      expect(await deliverMessageEmails()).toBe(1);
      expect(await deliverMessageEmails()).toBe(0);
      await send(OTH, enquiry, "Still there?");
      expect(await deliverMessageEmails()).toBe(0); // not read since the last email
      await rls.asUser(OWN, (tx) =>
        tx.execute(sql`select public.mark_conversation_read(${enquiry}::uuid)`),
      );
      await send(OTH, enquiry, "Hello again");
      expect(await deliverMessageEmails()).toBe(1);
    } finally {
      console.info = log;
    }
  });

  it("shares email and phone only with the other side of an accepted booking", async () => {
    const owner = db.getDb();
    await rls.asUser(PIL, (tx) =>
      tx
        .update(s.userSettings)
        .set({ phone: "+359 88 123 4567" })
        .where(sql`user_id = ${PIL}::uuid`),
    );
    const contacts = (user: string) =>
      rls
        .asUser(user, (tx) =>
          tx.execute(sql`select * from public.booking_contacts(${bookingId}::uuid)`),
        )
        .then((rows) => rows as unknown as { email: string; phone: string | null }[]);
    expect(await contacts(OWN)).toEqual([]); // still only requested
    await owner.execute(
      sql`update public.bookings set status = 'accepted' where id = ${bookingId}`,
    );
    expect(await contacts(OWN)).toMatchObject([
      { email: "pil-m@example.com", phone: "+359 88 123 4567" },
    ]);
    expect(await contacts(PIL)).toMatchObject([{ email: "own-m@example.com", phone: null }]);
    expect(await contacts(OTH)).toEqual([]);
    // Other people's settings stay private.
    expect(await rls.asUser(OWN, (tx) => tx.select().from(s.userSettings))).toHaveLength(1);
  });

  it("limits how many messages one person sends in a short time", async () => {
    await db.getDb().execute(sql`delete from public.messages where sender_id = ${OTH}::uuid`);
    for (let i = 0; i < 30; i++) expect(await send(OTH, enquiry, `Spam ${i}`)).toHaveLength(1);
    expect(await send(OTH, enquiry, "One more")).toEqual({ error: "too_many_messages" });
  });

  it("sends no message emails to people who turned them off (MSG-3)", async () => {
    const { deliverMessageEmails } = await import("@/lib/messages/emails");
    const setEmail = (on: boolean) =>
      rls.asUser(OWN, (tx) =>
        tx
          .update(s.userSettings)
          .set({ emailMessages: on })
          .where(sql`user_id = ${OWN}::uuid`),
      );
    const log = console.info;
    console.info = () => {};
    try {
      await setEmail(false);
      await send(PIL, bookingThread, "Running 10 minutes late");
      expect(await deliverMessageEmails()).toBe(0);
      await setEmail(true);
      expect(await deliverMessageEmails()).toBeGreaterThan(0);
    } finally {
      console.info = log;
    }
  });
});
