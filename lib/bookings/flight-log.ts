import "server-only";

import { asc, eq } from "drizzle-orm";

import { asUser } from "@/lib/db/rls";
import { flightLegs, flightLogs, flightUplifts } from "@/lib/db/schema";

/** The booking's flight log, legs and uplifts as the viewer may see them (pilot, owner, admin), or null. */
export async function getFlightLog(viewerId: string, bookingId: string) {
  return asUser(viewerId, async (tx) => {
    const [log] = await tx.select().from(flightLogs).where(eq(flightLogs.bookingId, bookingId));
    if (!log) return null;
    const legs = await tx
      .select()
      .from(flightLegs)
      .where(eq(flightLegs.flightLogId, log.id))
      .orderBy(asc(flightLegs.seq));
    const uplifts = await tx
      .select()
      .from(flightUplifts)
      .where(eq(flightUplifts.flightLogId, log.id))
      .orderBy(asc(flightUplifts.createdAt));
    return { log, legs, uplifts };
  });
}

export type FlightLogData = NonNullable<Awaited<ReturnType<typeof getFlightLog>>>;
