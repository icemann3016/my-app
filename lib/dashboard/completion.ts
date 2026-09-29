import "server-only";

import { and, eq } from "drizzle-orm";

import { listOwnAircraft } from "@/lib/aircraft/queries";
import { asUser } from "@/lib/db/rls";
import { aircraft, aircraftDocuments, userSettings } from "@/lib/db/schema";
import { getPilotCredentials } from "@/lib/pilot/credentials";
import { expiryState } from "@/lib/pilot/validity";
import { profileCompletion } from "@/lib/profile-completion";

/** The user's profile completion (see lib/profile-completion.ts), read with their own rights. */
export async function getProfileCompletion(
  userId: string,
  roles: { pilot: boolean; owner: boolean },
  profile: { avatarKey: string | null; homeAirportIdent: string | null; bio: string | null },
) {
  const [settings, creds, planes, pending] = await Promise.all([
    asUser(userId, (tx) =>
      tx
        .select({ phone: userSettings.phone })
        .from(userSettings)
        .where(eq(userSettings.userId, userId)),
    ),
    roles.pilot ? getPilotCredentials(userId) : null,
    roles.owner ? listOwnAircraft(userId) : [],
    roles.owner
      ? asUser(userId, (tx) =>
          tx
            .select({ aircraftId: aircraftDocuments.aircraftId, kind: aircraftDocuments.kind })
            .from(aircraftDocuments)
            .innerJoin(aircraft, eq(aircraft.id, aircraftDocuments.aircraftId))
            .where(and(eq(aircraft.ownerId, userId), eq(aircraftDocuments.status, "pending"))),
        )
      : [],
  ]);
  const expired = (date: string | null) => expiryState(date) === "expired";
  return profileCompletion({
    roles,
    profile,
    phone: settings[0]?.phone ?? null,
    pilot: creds
      ? {
          items: [
            ...creds.licences.map((l) => ({
              kind: "licence" as const,
              status: l.status,
              expired: expired(l.expiresOn),
            })),
            ...creds.ratings.map((r) => ({
              kind: "rating" as const,
              status: r.status,
              ratingKind: r.kind,
              expired: expired(r.expiresOn),
            })),
            ...creds.medicals.map((m) => ({
              kind: "medical" as const,
              status: m.status,
              expired: expired(m.validUntil),
            })),
          ],
          hasExperience: Boolean(creds.experience),
        }
      : null,
    aircraft: planes.map((a) => ({
      id: a.id,
      registration: a.registration,
      status: a.status,
      gaps: a.gaps,
      pendingKinds: pending.filter((p) => p.aircraftId === a.id).map((p) => p.kind),
    })),
  });
}
