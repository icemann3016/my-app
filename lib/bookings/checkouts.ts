import "server-only";

import { and, eq } from "drizzle-orm";

import { asUser } from "@/lib/db/rls";
import { aircraftCheckouts } from "@/lib/db/schema";

/** The pilot's recorded checkout flight on the aircraft, if any (owner, pilot, admin; RLS). */
export async function getCheckout(viewerId: string, aircraftId: string, pilotId: string) {
  const [row] = await asUser(viewerId, (tx) =>
    tx
      .select()
      .from(aircraftCheckouts)
      .where(
        and(eq(aircraftCheckouts.aircraftId, aircraftId), eq(aircraftCheckouts.pilotId, pilotId)),
      ),
  );
  return row ?? null;
}
