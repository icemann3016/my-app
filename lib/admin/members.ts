import "server-only";

import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { profiles, users } from "@/lib/db/schema";

// Member management for admins (ADM-2). Trusted admin code: callers must have checked the admin
// role with requireAdmin(); reads use the owner connection because they combine private account
// data (email, sign-in) with profiles.

export const MEMBER_FILTERS = [
  "all",
  "pilots",
  "owners",
  "admins",
  "suspended",
  "pending",
  "unverified",
] as const;
export type MemberFilter = (typeof MEMBER_FILTERS)[number];

export const MEMBER_SORTS = ["newest", "oldest", "name", "active"] as const;
export type MemberSort = (typeof MEMBER_SORTS)[number];

export const MEMBERS_PER_PAGE = 25;

const hasRole = (role: "pilot" | "owner" | "admin") =>
  sql`exists (select 1 from public.user_roles r where r.user_id = ${profiles.id} and r.role = ${role})`;

/** Last activity: the newest session (sessions end on log-out, so this can be empty). */
const lastSeen = sql<Date | null>`(select max(s.updated_at) from public.sessions s
  where s.user_id = ${profiles.id})`;

/** A licence and a medical that are verified and not expired: may rent aircraft. */
const pilotVerified = sql<boolean>`(
  exists (select 1 from public.pilot_licences l where l.user_id = ${profiles.id}
    and l.status = 'verified' and (l.expires_on is null or l.expires_on >= current_date))
  and exists (select 1 from public.medicals m where m.user_id = ${profiles.id}
    and m.status = 'verified' and m.valid_until >= current_date))`;

const pendingCredentials = sql<number>`(
  (select count(*) from public.pilot_licences l where l.user_id = ${profiles.id} and l.status = 'pending')
  + (select count(*) from public.pilot_ratings r where r.user_id = ${profiles.id} and r.status = 'pending')
  + (select count(*) from public.medicals m where m.user_id = ${profiles.id} and m.status = 'pending'))::int`;

const FILTERS: Record<MemberFilter, SQL | undefined> = {
  all: undefined,
  pilots: hasRole("pilot"),
  owners: hasRole("owner"),
  admins: hasRole("admin"),
  suspended: sql`${profiles.suspendedAt} is not null`,
  pending: sql`${pendingCredentials} > 0`,
  unverified: sql`not ${users.emailVerified}`,
};

const SORTS: Record<MemberSort, SQL[]> = {
  newest: [desc(profiles.createdAt)],
  oldest: [asc(profiles.createdAt)],
  name: [asc(sql`lower(${profiles.displayName})`)],
  active: [sql`${lastSeen} desc nulls last`, desc(profiles.createdAt)],
};

function escapeLike(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** One page of members with the facts an admin scans for, plus the total for paging. */
export async function listMembers(opts: {
  q: string;
  filter: MemberFilter;
  sort: MemberSort;
  page: number;
}) {
  const where = and(
    opts.q
      ? or(ilike(profiles.displayName, escapeLike(opts.q)), ilike(users.email, escapeLike(opts.q)))
      : undefined,
    FILTERS[opts.filter],
  );
  const db = getDb();
  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: profiles.id,
        name: profiles.displayName,
        email: users.email,
        emailVerified: users.emailVerified,
        avatarKey: profiles.avatarKey,
        suspendedAt: profiles.suspendedAt,
        createdAt: profiles.createdAt,
        ratingAvg: profiles.ratingAvg,
        ratingCount: profiles.ratingCount,
        ownerRatingAvg: profiles.ownerRatingAvg,
        ownerRatingCount: profiles.ownerRatingCount,
        lastSeen,
        pilotVerified,
        pendingCredentials,
        roles: sql<string[]>`coalesce((select array_agg(r.role::text order by r.role)
          from public.user_roles r where r.user_id = ${profiles.id}), '{}')`,
        aircraft: sql<number>`(select count(*) from public.aircraft a
          where a.owner_id = ${profiles.id} and a.status <> 'draft')::int`,
        flights: sql<number>`(select count(*) from public.bookings b
          where b.pilot_id = ${profiles.id} and b.status = 'completed')::int`,
      })
      .from(profiles)
      .innerJoin(users, eq(users.id, profiles.id))
      .where(where)
      .orderBy(...SORTS[opts.sort])
      .limit(MEMBERS_PER_PAGE)
      .offset((opts.page - 1) * MEMBERS_PER_PAGE),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(profiles)
      .innerJoin(users, eq(users.id, profiles.id))
      .where(where),
  ]);
  return { rows, total: count?.n ?? 0 };
}

export type MemberRow = Awaited<ReturnType<typeof listMembers>>["rows"][number];

/** Counts for the filter chips. */
export async function memberCounts(): Promise<Record<MemberFilter, number>> {
  const entries = await Promise.all(
    MEMBER_FILTERS.map(async (f) => {
      const [row] = await getDb()
        .select({ n: sql<number>`count(*)::int` })
        .from(profiles)
        .innerJoin(users, eq(users.id, profiles.id))
        .where(FILTERS[f]);
      return [f, row?.n ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<MemberFilter, number>;
}
