import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";

import { isDatabaseConfigured, type Tx } from "@/lib/db";
import { asAnon, asUser } from "@/lib/db/rls";
import { aircraft, profiles } from "@/lib/db/schema";
import { isUuid } from "./queries";

/**
 * An aircraft as the viewer may see it: listed aircraft for everyone, any status for the owner
 * and admins (RLS decides). Null if hidden or missing. Cached per request.
 */
export const getVisibleAircraft = cache(async (viewerId: string | null, id: string) => {
  if (!isUuid(id) || !isDatabaseConfigured()) return null;
  const query = async (tx: Tx) => {
    const [row] = await tx
      .select({
        aircraft,
        owner: {
          id: profiles.id,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          ratingAvg: profiles.ratingAvg,
          ratingCount: profiles.ratingCount,
          createdAt: profiles.createdAt,
        },
      })
      .from(aircraft)
      .innerJoin(profiles, eq(profiles.id, aircraft.ownerId))
      .where(eq(aircraft.id, id));
    return row ?? null;
  };
  return viewerId ? asUser(viewerId, query) : asAnon(query);
});
