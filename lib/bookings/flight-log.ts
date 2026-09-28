import "server-only";

import { asc, eq } from "drizzle-orm";

import { asUser } from "@/lib/db/rls";
import { flightLegs, flightLogs, flightRemarks, flightUplifts } from "@/lib/db/schema";

/** The booking's flight log, legs, uplifts and remarks as the viewer may see them (pilot, owner, admin), or null. */
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
    const remarks = await tx
      .select()
      .from(flightRemarks)
      .where(eq(flightRemarks.flightLogId, log.id))
      .orderBy(asc(flightRemarks.createdAt));
    return { log, legs, uplifts, remarks };
  });
}

export type FlightLogData = NonNullable<Awaited<ReturnType<typeof getFlightLog>>>;
