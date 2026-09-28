import { getTranslations } from "next-intl/server";

import { getUser } from "@/lib/auth/session";
import { airportCodes, getPilotLegs } from "@/lib/bookings/usage";
import { csvResponse, toCsv } from "@/lib/csv";

const clock = (d: Date | null) => (d ? d.toISOString().slice(11, 16) : "");
const hhmm = (from: Date, to: Date) => {
  const m = Math.round((to.getTime() - from.getTime()) / 60_000);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};

/**
 * The pilot's own legs as CSV, in the order of a logbook (BKG-16): date, departure and arrival
 * with block times in UTC, aircraft type and registration, block time, landings. A help for
 * filling in the pilot's logbook, which it doesn't replace.
 */
export async function GET() {
  const user = await getUser();
  if (!user) return new Response("Please log in again.", { status: 401 });
  const t = await getTranslations("usage.logbook");
  const legs = await getPilotLegs(user.id);
  const codes = await airportCodes(legs.flatMap((l) => [l.fromIdent, l.toIdent]));
  const header = [
    "date",
    "departure",
    "offBlock",
    "arrival",
    "onBlock",
    "type",
    "registration",
    "takeoff",
    "landing",
    "blockTime",
    "landings",
  ].map((key) => t(key as "date"));
  const rows = legs.map((l) => [
    l.blockOff.toISOString().slice(0, 10),
    codes.get(l.fromIdent) ?? l.fromIdent,
    clock(l.blockOff),
    codes.get(l.toIdent) ?? l.toIdent,
    clock(l.blockOn),
    l.aircraft.typeDesignator,
    l.aircraft.registration,
    clock(l.takeoffAt),
    clock(l.landingAt),
    hhmm(l.blockOff, l.blockOn),
    l.landings,
  ]);
  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(toCsv(header, rows), `ownaplane-flights-${date}.csv`);
}
