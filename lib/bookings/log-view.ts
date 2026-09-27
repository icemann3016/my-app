import "server-only";

import { eq } from "drizzle-orm";

import { type AirportSummary, getAirport } from "@/lib/airports";
import { asUser } from "@/lib/db/rls";
import { documents } from "@/lib/db/schema";

/** The check-out photo's file name for its uploader (RLS: only the owner of the document). */
export async function getLogPhoto(userId: string, documentId: string | null) {
  if (!documentId) return null;
  const [doc] = await asUser(userId, (tx) =>
    tx
      .select({ id: documents.id, filename: documents.filename })
      .from(documents)
      .where(eq(documents.id, documentId)),
  );
  return doc ?? null;
}

/** Airports of a log's legs (and the booking's departure), by ident. */
export async function logAirports(idents: string[]): Promise<Record<string, AirportSummary>> {
  const unique = [...new Set(idents)];
  const found = await Promise.all(unique.map((ident) => getAirport(ident)));
  return Object.fromEntries(found.filter((a) => a !== null).map((a) => [a.ident, a]));
}
