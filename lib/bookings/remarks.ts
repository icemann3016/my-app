import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { asUser } from "@/lib/db/rls";
import { airports, bookings, flightLogs, flightRemarks } from "@/lib/db/schema";

export type KnownItem = { id: string; body: string; knownSince: Date };

/**
 * Open known items of an aircraft (BKG-15), for its owner and pilots with an open or upcoming
 * booking of it; empty for everyone else. Never says who wrote them.
 */
export async function getKnownItems(userId: string, aircraftId: string): Promise<KnownItem[]> {
  const rows = (await asUser(userId, (tx) =>
    tx.execute(sql`select * from public.known_items_for_aircraft(${aircraftId}::uuid)`),
  )) as unknown as { id: string; body: string; known_since: string }[];
  return rows.map((r) => ({ id: r.id, body: r.body, knownSince: new Date(r.known_since) }));
}

/** All remarks about an aircraft, newest first, for its owner's history (RLS). */
export async function getAircraftRemarks(ownerId: string, aircraftId: string, limit = 200) {
  return asUser(ownerId, (tx) =>
    tx
      .select({
        remark: flightRemarks,
        bookingId: bookings.id,
        flownFrom: sql<string>`lower(${bookings.period})`,
        airportCode: sql<string | null>`coalesce(${airports.icaoCode}, ${airports.ident})`,
      })
      .from(flightRemarks)
      .innerJoin(flightLogs, eq(flightLogs.id, flightRemarks.flightLogId))
      .innerJoin(bookings, eq(bookings.id, flightLogs.bookingId))
      .leftJoin(airports, eq(airports.ident, flightRemarks.airportIdent))
      .where(eq(flightRemarks.aircraftId, aircraftId))
      .orderBy(desc(flightRemarks.createdAt))
      .limit(limit),
  );
}
