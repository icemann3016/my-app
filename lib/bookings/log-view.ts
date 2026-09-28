import "server-only";

import { inArray } from "drizzle-orm";

import { type AirportSummary, getAirport } from "@/lib/airports";
import { asUser } from "@/lib/db/rls";
import { documents } from "@/lib/db/schema";

/**
 * File names of the log's photo and receipts, by id. RLS: the uploader, and the other party of
 * the booking (flight_log_document_visible()).
 */
export async function logDocuments(
  userId: string,
  ids: (string | null)[],
): Promise<Record<string, { id: string; filename: string }>> {
  const wanted = ids.filter((id): id is string => id !== null);
  if (!wanted.length) return {};
  const rows = await asUser(userId, (tx) =>
    tx
      .select({ id: documents.id, filename: documents.filename })
      .from(documents)
      .where(inArray(documents.id, wanted)),
  );
  return Object.fromEntries(rows.map((r) => [r.id, r]));
}

/** Airports of a log's legs (and the booking's departure), by ident. */
export async function logAirports(idents: string[]): Promise<Record<string, AirportSummary>> {
  const unique = [...new Set(idents)];
  const found = await Promise.all(unique.map((ident) => getAirport(ident)));
  return Object.fromEntries(found.filter((a) => a !== null).map((a) => [a.ident, a]));
}
