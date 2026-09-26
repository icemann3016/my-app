import "server-only";

import { eq, sql } from "drizzle-orm";

import { isDatabaseConfigured } from "@/lib/db";
import { asAnon } from "@/lib/db/rls";
import { airports } from "@/lib/db/schema";

/** What the UI needs to show an airport. */
export type AirportSummary = {
  ident: string;
  /** Code to display: ICAO if there is one, otherwise the local id (e.g. BG-0004). */
  code: string;
  iataCode: string | null;
  name: string;
  municipality: string | null;
  country: string;
  type: string;
  timezone: string;
};

const summaryColumns = {
  ident: airports.ident,
  icaoCode: airports.icaoCode,
  iataCode: airports.iataCode,
  name: airports.name,
  municipality: airports.municipality,
  country: airports.country,
  type: airports.type,
  timezone: airports.timezone,
};

type Row = {
  ident: string;
  icaoCode: string | null;
  iataCode: string | null;
  name: string;
  municipality: string | null;
  country: string;
  type: string;
  timezone: string;
};

function toSummary({ icaoCode, ...row }: Row): AirportSummary {
  return { ...row, code: icaoCode ?? row.ident };
}

/** Escape % and _ so user input is matched literally in LIKE patterns. */
function likeEscape(text: string) {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Search airfields by code (ICAO, IATA, local id), name, city or alternative names.
 * Exact code matches first, then code prefixes, then name/city matches; bigger airports first.
 */
export async function searchAirports(query: string, limit = 10): Promise<AirportSummary[]> {
  const q = query.trim();
  if (q.length < 2 || !isDatabaseConfigured()) return [];
  const upper = q.toUpperCase();
  const prefix = `${likeEscape(q)}%`;
  const contains = `%${likeEscape(q)}%`;

  const rows = await asAnon((tx) =>
    tx
      .select(summaryColumns)
      .from(airports)
      .where(
        sql`${airports.ident} ilike ${prefix} or ${airports.icaoCode} ilike ${prefix}
          or ${airports.iataCode} ilike ${prefix} or ${airports.gpsCode} ilike ${prefix}
          or ${airports.localCode} ilike ${prefix} or ${airports.name} ilike ${contains}
          or ${airports.municipality} ilike ${contains} or ${airports.keywords} ilike ${contains}`,
      )
      .orderBy(
        sql`case
          when upper(${airports.ident}) = ${upper} or ${airports.icaoCode} = ${upper}
            or ${airports.iataCode} = ${upper} then 0
          when ${airports.ident} ilike ${prefix} or ${airports.icaoCode} ilike ${prefix} then 1
          when ${airports.name} ilike ${prefix} or ${airports.municipality} ilike ${prefix} then 2
          else 3 end`,
        sql`case ${airports.type} when 'large_airport' then 0 when 'medium_airport' then 1 else 2 end`,
        airports.name,
      )
      .limit(limit),
  );
  return rows.map(toSummary);
}

export async function getAirport(ident: string | null | undefined): Promise<AirportSummary | null> {
  if (!ident || !isDatabaseConfigured()) return null;
  const [row] = await asAnon((tx) =>
    tx.select(summaryColumns).from(airports).where(eq(airports.ident, ident)),
  );
  return row ? toSummary(row) : null;
}

/** "Sofia Airport · Sofia, BG" */
export function airportPlace(airport: Pick<AirportSummary, "name" | "municipality" | "country">) {
  const where = [airport.municipality, airport.country].filter(Boolean).join(", ");
  return where ? `${airport.name} · ${where}` : airport.name;
}
