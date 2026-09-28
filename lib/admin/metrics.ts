import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";

// Dashboard numbers (ADM-4). Trusted code: callers must have called requireAdmin().

export type Metrics = {
  users: number;
  newUsers: number;
  pilots: number;
  owners: number;
  listedAircraft: number;
  requested: number;
  accepted: number;
  completed: number;
  cancelled: number;
  lateCancelled: number;
  declinedOrExpired: number;
  openReports: number;
  pendingVerifications: number;
  reviews: number;
  suspended: number;
  signupsByWeek: { week: string; n: number }[];
};

/** Counts for the last `days` days (bookings by creation date) and totals. */
export async function getMetrics(days = 30): Promise<Metrics> {
  const since = sql`now() - make_interval(days => ${days})`;
  const [row] = (await getDb().execute(sql`
    select
      (select count(*) from public.profiles)::int as users,
      (select count(*) from public.profiles where created_at > ${since})::int as new_users,
      (select count(*) from public.user_roles where role = 'pilot')::int as pilots,
      (select count(*) from public.user_roles where role = 'owner')::int as owners,
      (select count(*) from public.aircraft where status = 'listed')::int as listed_aircraft,
      (select count(*) from public.bookings where created_at > ${since})::int as requested,
      (select count(*) from public.bookings where created_at > ${since}
        and status in ('accepted', 'in_progress', 'completed'))::int as accepted,
      (select count(*) from public.bookings where created_at > ${since}
        and status = 'completed')::int as completed,
      (select count(*) from public.bookings where created_at > ${since}
        and status = 'cancelled')::int as cancelled,
      (select count(*) from public.bookings where created_at > ${since}
        and status = 'cancelled' and late_cancellation)::int as late_cancelled,
      (select count(*) from public.bookings where created_at > ${since}
        and status in ('declined', 'expired'))::int as declined_or_expired,
      (select count(*) from public.reports where status = 'open')::int as open_reports,
      ((select count(*) from public.pilot_licences where status = 'pending')
        + (select count(*) from public.pilot_ratings where status = 'pending')
        + (select count(*) from public.medicals where status = 'pending')
        + (select count(*) from public.aircraft_documents where status = 'pending'))::int
        as pending_verifications,
      (select count(*) from public.reviews where published_at > ${since})::int as reviews,
      (select count(*) from public.profiles where suspended_at is not null)::int as suspended,
      (select coalesce(json_agg(json_build_object('week', w.week, 'n', w.n) order by w.week), '[]')
        from (select to_char(g.week at time zone 'utc', 'YYYY-MM-DD') as week,
                (select count(*) from public.profiles p
                 where p.created_at >= g.week and p.created_at < g.week + interval '7 days')::int as n
              from generate_series(date_trunc('week', now(), 'UTC') - interval '7 weeks',
                                   date_trunc('week', now(), 'UTC'), interval '1 week')
                as g(week)) w) as signups_by_week
  `)) as unknown as Record<string, unknown>[];
  const r = row!;
  return {
    users: Number(r.users),
    newUsers: Number(r.new_users),
    pilots: Number(r.pilots),
    owners: Number(r.owners),
    listedAircraft: Number(r.listed_aircraft),
    requested: Number(r.requested),
    accepted: Number(r.accepted),
    completed: Number(r.completed),
    cancelled: Number(r.cancelled),
    lateCancelled: Number(r.late_cancelled),
    declinedOrExpired: Number(r.declined_or_expired),
    openReports: Number(r.open_reports),
    pendingVerifications: Number(r.pending_verifications),
    reviews: Number(r.reviews),
    suspended: Number(r.suspended),
    signupsByWeek: r.signups_by_week as { week: string; n: number }[],
  };
}
