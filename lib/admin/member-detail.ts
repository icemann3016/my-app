import "server-only";

import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/lib/db";
import {
  accounts,
  adminActions,
  aircraft,
  bookings,
  profiles,
  reports,
  sessions,
  userRoles,
  userSettings,
  users,
} from "@/lib/db/schema";
import { credentialItems, getPilotCredentials } from "@/lib/pilot/credentials";
import { pilotSummary } from "@/lib/pilot/summary";

// Everything an admin needs about one member (ADM-2). Trusted admin code after requireAdmin().

const bookingStats = sql`count(*)::int as total,
  count(*) filter (where status = 'completed')::int as completed,
  count(*) filter (where status in ('requested', 'accepted', 'in_progress'))::int as open,
  count(*) filter (where status = 'cancelled')::int as cancelled,
  count(*) filter (where late_cancellation)::int as late`;

type BookingStats = {
  total: number;
  completed: number;
  open: number;
  cancelled: number;
  late: number;
};

async function stats(column: "pilot_id" | "owner_id", userId: string): Promise<BookingStats> {
  const rows = (await getDb().execute(
    sql`select ${bookingStats} from public.bookings where ${sql.identifier(column)} = ${userId}::uuid`,
  )) as unknown as BookingStats[];
  return rows[0] ?? { total: 0, completed: 0, open: 0, cancelled: 0, late: 0 };
}

export async function getMemberDetail(userId: string, adminId: string) {
  const db = getDb();
  const [member] = await db
    .select({
      id: profiles.id,
      name: profiles.displayName,
      bio: profiles.bio,
      avatarKey: profiles.avatarKey,
      homeAirportIdent: profiles.homeAirportIdent,
      email: users.email,
      emailVerified: users.emailVerified,
      createdAt: profiles.createdAt,
      suspendedAt: profiles.suspendedAt,
      ratingAvg: profiles.ratingAvg,
      ratingCount: profiles.ratingCount,
      ownerRatingAvg: profiles.ownerRatingAvg,
      ownerRatingCount: profiles.ownerRatingCount,
      locale: userSettings.locale,
      phone: userSettings.phone,
    })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.id))
    .leftJoin(userSettings, eq(userSettings.userId, profiles.id))
    .where(eq(profiles.id, userId));
  if (!member) return null;

  const actor = alias(profiles, "actor");
  const [roles, methods, activity, planes, asPilot, asOwner, openReports, history, credentials] =
    await Promise.all([
      db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId)),
      db
        .select({ providerId: accounts.providerId })
        .from(accounts)
        .where(eq(accounts.userId, userId)),
      db
        .select({
          sessions: sql<number>`count(*)::int`,
          lastSeen: sql<Date | null>`max(${sessions.updatedAt})`,
        })
        .from(sessions)
        .where(and(eq(sessions.userId, userId), sql`${sessions.expiresAt} > now()`)),
      db
        .select({
          id: aircraft.id,
          registration: aircraft.registration,
          manufacturer: aircraft.manufacturer,
          model: aircraft.model,
          status: aircraft.status,
          unlistedReason: aircraft.unlistedReason,
        })
        .from(aircraft)
        .where(eq(aircraft.ownerId, userId))
        .orderBy(aircraft.registration),
      stats("pilot_id", userId),
      stats("owner_id", userId),
      db
        .select({ id: reports.id, reason: reports.reason, createdAt: reports.createdAt })
        .from(reports)
        .where(
          and(
            eq(reports.status, "open"),
            or(
              and(eq(reports.targetType, "user"), eq(reports.targetId, userId)),
              and(
                eq(reports.targetType, "aircraft"),
                inArray(
                  reports.targetId,
                  db.select({ id: aircraft.id }).from(aircraft).where(eq(aircraft.ownerId, userId)),
                ),
              ),
            ),
          ),
        ),
      db
        .select({
          id: adminActions.id,
          action: adminActions.action,
          reason: adminActions.reason,
          createdAt: adminActions.createdAt,
          adminName: actor.displayName,
        })
        .from(adminActions)
        .leftJoin(actor, eq(actor.id, adminActions.adminId))
        .where(and(eq(adminActions.targetType, "user"), eq(adminActions.targetId, userId)))
        .orderBy(desc(adminActions.createdAt))
        .limit(20),
      // Credentials as the admin may see them (RLS lets admins read them).
      getPilotCredentials(userId, adminId),
    ]);

  const recentBookings = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      from: sql<string>`lower(${bookings.period})`,
      to: sql<string>`upper(${bookings.period})`,
      registration: aircraft.registration,
      asPilot: sql<boolean>`${bookings.pilotId} = ${userId}::uuid`,
    })
    .from(bookings)
    .innerJoin(aircraft, eq(aircraft.id, bookings.aircraftId))
    .where(or(eq(bookings.pilotId, userId), eq(bookings.ownerId, userId)))
    .orderBy(desc(bookings.createdAt))
    .limit(8);

  return {
    ...member,
    roles: roles.map((r) => r.role),
    signInMethods: [...new Set(methods.map((m) => m.providerId))],
    activeSessions: activity[0]?.sessions ?? 0,
    lastSeen: activity[0]?.lastSeen ?? null,
    aircraft: planes,
    asPilot,
    asOwner,
    openReports,
    history,
    pilot: pilotSummary(credentialItems(credentials)),
    credentialCount:
      credentials.licences.length + credentials.ratings.length + credentials.medicals.length,
    totalHours: credentials.experience?.totalHours ?? null,
    recentBookings,
  };
}

export type MemberDetail = NonNullable<Awaited<ReturnType<typeof getMemberDetail>>>;
