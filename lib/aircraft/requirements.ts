import "server-only";

import { eq } from "drizzle-orm";

import type { Tx } from "@/lib/db";
import { asAnon, asUser } from "@/lib/db/rls";
import { type RentalRequirements, rentalRequirements } from "@/lib/db/schema";
import { CLASS_RATINGS, PRIVILEGES } from "@/lib/pilot/catalog";

/** An aircraft's rental requirements as the viewer may see them, or null if none were set. */
export async function getRequirements(
  viewerId: string | null,
  aircraftId: string,
): Promise<RentalRequirements | null> {
  const query = (tx: Tx) =>
    tx.select().from(rentalRequirements).where(eq(rentalRequirements.aircraftId, aircraftId));
  const [row] = viewerId ? await asUser(viewerId, query) : await asAnon(query);
  return row ?? null;
}

const known = new Set<string>([...CLASS_RATINGS, ...PRIVILEGES]);

/** Split required ratings into class ratings/privileges and ICAO type ratings. */
export function splitRatings(codes: string[]) {
  return {
    listed: codes.filter((c) => known.has(c)),
    types: codes.filter((c) => !known.has(c)),
  };
}

/** Requirements as form values (strings; lists comma separated). */
export function requirementsFormValues(r: RentalRequirements | null): Record<string, string> {
  const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  const { listed, types } = splitRatings(r?.requiredRatings ?? []);
  return {
    minPilotRating: str(r?.minPilotRating),
    allowUnrated: (r?.allowUnrated ?? true) ? "on" : "",
    unratedNeedsCheckout: r?.unratedNeedsCheckout ? "on" : "",
    checkoutFirstRental: r?.checkoutFirstRental ? "on" : "",
    instantBooking: r?.instantBooking ? "on" : "",
    licenceTypes: (r?.licenceTypes ?? []).join(","),
    requiredRatings: listed.join(","),
    typeRating: types[0] ?? "",
    minTotalHours: str(r?.minTotalHours),
    minTypeHours: str(r?.minTypeHours),
    min90DaysHours: str(r?.min90DaysHours),
    minAge: str(r?.minAge),
  };
}
