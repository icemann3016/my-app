import "server-only";

import { cache } from "react";
import { and, asc, desc, eq, sql } from "drizzle-orm";

import type { Tx } from "@/lib/db";
import { asAnon, asUser } from "@/lib/db/rls";
import { aircraft, aircraftPhotos, userSettings } from "@/lib/db/schema";
import { isUnitSystem, type UnitSystem } from "@/lib/domain/units";
import { getStorage } from "@/lib/storage";
import type { ListingGap } from "./catalog";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (id: string) => UUID.test(id);

/** One of the user's own aircraft, or null (also for other people's aircraft). Cached per request. */
export const getOwnAircraft = cache(async (userId: string, id: string) => {
  if (!isUuid(id)) return null;
  const [row] = await asUser(userId, (tx) =>
    tx
      .select()
      .from(aircraft)
      .where(and(eq(aircraft.id, id), eq(aircraft.ownerId, userId))),
  );
  return row ?? null;
});

/** What still stops the aircraft being listed (empty = ready). Owner or admin only. */
export async function getListingGaps(userId: string, id: string): Promise<ListingGap[]> {
  const rows = (await asUser(userId, (tx) =>
    tx.execute(sql`select public.aircraft_listing_gaps(${id}::uuid) as gaps`),
  )) as unknown as { gaps: ListingGap[] | null }[];
  return rows[0]?.gaps ?? [];
}

/** The owner's aircraft with their cover photo and listing gaps, newest first. */
export async function listOwnAircraft(userId: string) {
  const rows = await asUser(userId, (tx) =>
    tx
      .select({
        id: aircraft.id,
        registration: aircraft.registration,
        manufacturer: aircraft.manufacturer,
        model: aircraft.model,
        status: aircraft.status,
        unlistedReason: aircraft.unlistedReason,
        homeAirportIdent: aircraft.homeAirportIdent,
        pricePerHour: aircraft.pricePerHour,
        currency: aircraft.currency,
        priceBasis: aircraft.priceBasis,
        cover: sql<string | null>`(
          select ${aircraftPhotos.storageKey} from ${aircraftPhotos}
          where ${aircraftPhotos.aircraftId} = ${aircraft.id}
          order by ${aircraftPhotos.sortOrder}, ${aircraftPhotos.createdAt} limit 1)`,
        gaps: sql<ListingGap[]>`public.aircraft_listing_gaps(${aircraft.id})`,
      })
      .from(aircraft)
      .where(eq(aircraft.ownerId, userId))
      .orderBy(desc(aircraft.createdAt)),
  );
  return rows.map(({ cover, ...row }) => ({ ...row, coverUrl: photoUrl(cover) }));
}

export type OwnAircraftSummary = Awaited<ReturnType<typeof listOwnAircraft>>[number];

/** Photos of an aircraft the viewer may see, cover first. */
export async function getPhotos(viewerId: string | null, aircraftId: string) {
  const query = (tx: Tx) =>
    tx
      .select()
      .from(aircraftPhotos)
      .where(eq(aircraftPhotos.aircraftId, aircraftId))
      .orderBy(asc(aircraftPhotos.sortOrder), asc(aircraftPhotos.createdAt));
  const rows = viewerId ? await asUser(viewerId, query) : await asAnon(query);
  return rows.map((p) => ({ ...p, url: photoUrl(p.storageKey)! }));
}

export function photoUrl(key: string | null | undefined): string | null {
  return key ? getStorage().publicUrl(key) : null;
}

/** The user's preferred units (metric by default). */
export async function getUnits(userId: string): Promise<UnitSystem> {
  const [row] = await asUser(userId, (tx) =>
    tx
      .select({ units: userSettings.units })
      .from(userSettings)
      .where(eq(userSettings.userId, userId)),
  );
  return isUnitSystem(row?.units) ? row.units : "metric";
}
