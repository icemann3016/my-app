import "server-only";

import { cache } from "react";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";

import { getAirport } from "@/lib/airports";
import { type Tx } from "@/lib/db";
import { asAnon, asUser } from "@/lib/db/rls";
import {
  aircraft,
  aircraftDocuments,
  aircraftFiles,
  aircraftPhotos,
  documents,
  profiles,
  rentalRequirements,
} from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";

export function photoUrl(key: string): string {
  return getStorage().publicUrl(key);
}

/** What still stops the aircraft from being listed (see public.aircraft_listing_problems). */
export async function listingProblems(tx: Tx, aircraftId: string): Promise<string[]> {
  const rows = (await tx.execute(
    sql`select public.aircraft_listing_problems(a) as problems from ${aircraft} a where a.id = ${aircraftId}`,
  )) as unknown as { problems: string[] }[];
  return rows[0]?.problems ?? [];
}

/** The owner's aircraft, newest first, with cover photo and listing problems. */
export async function getOwnerAircraft(ownerId: string) {
  return asUser(ownerId, async (tx) => {
    const rows = await tx
      .select()
      .from(aircraft)
      .where(eq(aircraft.ownerId, ownerId))
      .orderBy(desc(aircraft.createdAt));
    if (!rows.length) return [];
    const photos = await tx
      .select({ aircraftId: aircraftPhotos.aircraftId, storageKey: aircraftPhotos.storageKey })
      .from(aircraftPhotos)
      .where(
        inArray(
          aircraftPhotos.aircraftId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(aircraftPhotos.sortOrder), asc(aircraftPhotos.createdAt));
    const covers = new Map<string, string>();
    for (const p of photos) if (!covers.has(p.aircraftId)) covers.set(p.aircraftId, p.storageKey);
    const problems = await Promise.all(rows.map((r) => listingProblems(tx, r.id)));
    return rows.map((a, i) => ({
      ...a,
      coverUrl: covers.has(a.id) ? photoUrl(covers.get(a.id)!) : null,
      problems: problems[i]!,
    }));
  });
}

/** Everything the owner edits. Null if it isn't theirs (RLS) or doesn't exist. Cached per request. */
export const getAircraftForOwner = cache(async (ownerId: string, aircraftId: string) => {
  return asUser(ownerId, async (tx) => {
    const [a] = await tx.select().from(aircraft).where(eq(aircraft.id, aircraftId));
    if (!a || a.ownerId !== ownerId) return null;
    const [photos, docs, files, [requirements], problems] = await Promise.all([
      tx
        .select()
        .from(aircraftPhotos)
        .where(eq(aircraftPhotos.aircraftId, aircraftId))
        .orderBy(asc(aircraftPhotos.sortOrder), asc(aircraftPhotos.createdAt)),
      tx
        .select({ doc: aircraftDocuments, filename: documents.filename })
        .from(aircraftDocuments)
        .leftJoin(documents, eq(documents.id, aircraftDocuments.documentId))
        .where(eq(aircraftDocuments.aircraftId, aircraftId))
        .orderBy(asc(aircraftDocuments.kind), desc(aircraftDocuments.createdAt)),
      tx
        .select({ file: aircraftFiles, filename: documents.filename })
        .from(aircraftFiles)
        .innerJoin(documents, eq(documents.id, aircraftFiles.documentId))
        .where(eq(aircraftFiles.aircraftId, aircraftId))
        .orderBy(asc(aircraftFiles.createdAt)),
      tx.select().from(rentalRequirements).where(eq(rentalRequirements.aircraftId, aircraftId)),
      listingProblems(tx, aircraftId),
    ]);
    return {
      aircraft: a,
      photos: photos.map((p) => ({ ...p, url: photoUrl(p.storageKey) })),
      documents: docs.map((d) => ({ ...d.doc, filename: d.filename })),
      files: files.map((f) => ({ ...f.file, filename: f.filename })),
      requirements: requirements ?? null,
      problems,
    };
  });
});

export type OwnerAircraft = NonNullable<Awaited<ReturnType<typeof getAircraftForOwner>>>;

/**
 * An aircraft as the viewer may see it: listed aircraft for everyone, drafts etc. only for the
 * owner and admins (RLS). Never includes documents.
 */
export async function getAircraftForViewer(viewerId: string | null, aircraftId: string) {
  const load = async (tx: Tx) => {
    const [a] = await tx.select().from(aircraft).where(eq(aircraft.id, aircraftId));
    if (!a) return null;
    const [photos, [requirements], [owner]] = await Promise.all([
      tx
        .select()
        .from(aircraftPhotos)
        .where(eq(aircraftPhotos.aircraftId, aircraftId))
        .orderBy(asc(aircraftPhotos.sortOrder), asc(aircraftPhotos.createdAt)),
      tx.select().from(rentalRequirements).where(eq(rentalRequirements.aircraftId, aircraftId)),
      tx
        .select({
          id: profiles.id,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          ratingAvg: profiles.ratingAvg,
          ratingCount: profiles.ratingCount,
        })
        .from(profiles)
        .where(eq(profiles.id, a.ownerId)),
    ]);
    return {
      aircraft: a,
      photos: photos.map((p) => ({ id: p.id, url: photoUrl(p.storageKey) })),
      requirements: requirements ?? null,
      owner: owner ?? null,
    };
  };
  const data = viewerId ? await asUser(viewerId, load) : await asAnon(load);
  if (!data) return null;
  return { ...data, homeAirport: await getAirport(data.aircraft.homeAirportIdent) };
}

/** Listed aircraft of one owner, for their public profile. */
export async function getListedAircraftOf(ownerId: string) {
  return asAnon(async (tx) => {
    const rows = await tx
      .select({
        id: aircraft.id,
        registration: aircraft.registration,
        manufacturer: aircraft.manufacturer,
        model: aircraft.model,
        homeAirportIdent: aircraft.homeAirportIdent,
        pricePerHour: aircraft.pricePerHour,
        currency: aircraft.currency,
        cover: sql<
          string | null
        >`(select p.storage_key from ${aircraftPhotos} p where p.aircraft_id = ${aircraft.id} order by p.sort_order, p.created_at limit 1)`,
      })
      .from(aircraft)
      .where(sql`${aircraft.ownerId} = ${ownerId} and ${aircraft.status} = 'listed'`)
      .orderBy(asc(aircraft.registration));
    return rows.map((r) => ({ ...r, coverUrl: r.cover ? photoUrl(r.cover) : null }));
  });
}
