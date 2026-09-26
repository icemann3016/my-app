import "server-only";

import { asc, desc, eq, sql } from "drizzle-orm";

import { asAnon, asUser } from "@/lib/db/rls";
import {
  documents,
  experienceByType,
  medicals,
  pilotExperience,
  pilotLicences,
  pilotRatings,
} from "@/lib/db/schema";
import type { CredentialRef } from "./labels";
import type { CredentialItem } from "./summary";

export type DocumentInfo = { id: string; filename: string };

/**
 * A pilot's credentials as `viewerId` may see them (the pilot or an admin; enforced by RLS).
 */
export async function getPilotCredentials(pilotId: string, viewerId: string = pilotId) {
  return asUser(viewerId, async (tx) => {
    const [licences, ratings, meds, experience, typeHours, docs] = await Promise.all([
      tx
        .select()
        .from(pilotLicences)
        .where(eq(pilotLicences.userId, pilotId))
        .orderBy(asc(pilotLicences.createdAt)),
      tx
        .select()
        .from(pilotRatings)
        .where(eq(pilotRatings.userId, pilotId))
        .orderBy(asc(pilotRatings.kind), asc(pilotRatings.code)),
      tx
        .select()
        .from(medicals)
        .where(eq(medicals.userId, pilotId))
        .orderBy(desc(medicals.validUntil)),
      tx.select().from(pilotExperience).where(eq(pilotExperience.userId, pilotId)),
      tx
        .select()
        .from(experienceByType)
        .where(eq(experienceByType.userId, pilotId))
        .orderBy(desc(experienceByType.hours)),
      tx
        .select({ id: documents.id, filename: documents.filename })
        .from(documents)
        .where(eq(documents.ownerId, pilotId)),
    ]);
    const documentsById = new Map<string, DocumentInfo>(docs.map((d) => [d.id, d]));
    return {
      licences,
      ratings,
      medicals: meds,
      experience: experience[0] ?? null,
      typeHours,
      documentsById,
    };
  });
}

export type PilotCredentials = Awaited<ReturnType<typeof getPilotCredentials>>;

/** Flat list for pilotSummary(). */
export function credentialItems(c: PilotCredentials): CredentialItem[] {
  return [
    ...c.licences.map((l) => ({
      id: l.id,
      kind: "licence" as const,
      status: l.status,
      expiresOn: l.expiresOn,
      ref: { kind: "licence" as const, type: l.type },
    })),
    ...c.ratings.map((r) => ({
      id: r.id,
      kind: "rating" as const,
      status: r.status,
      expiresOn: r.expiresOn,
      ref: { kind: "rating" as const, ratingKind: r.kind, code: r.code },
    })),
    ...c.medicals.map((m) => ({
      id: m.id,
      kind: "medical" as const,
      status: m.status,
      expiresOn: m.validUntil,
      ref: { kind: "medical" as const, class: m.class },
    })),
  ];
}

/**
 * Public badges: verified, unexpired licence types and ratings only (see the SQL function
 * public.pilot_badges). Safe to show to anyone.
 */
export async function getPilotBadges(pilotId: string): Promise<CredentialRef[]> {
  const rows = await asAnon(
    (tx) =>
      tx.execute(
        sql`select kind, code from public.pilot_badges(${pilotId}) order by kind desc, code`,
      ) as unknown as Promise<{ kind: string; code: string }[]>,
  );
  return rows.map((r) =>
    r.kind === "licence"
      ? { kind: "licence", type: r.code }
      : { kind: "rating", ratingKind: r.kind, code: r.code },
  );
}
