import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import type { Tx } from "@/lib/db";
import { asAnon, asUser } from "@/lib/db/rls";
import { calendarEntries, type CalendarEntryKind } from "@/lib/db/schema";

export type CalendarItem = {
  id: string;
  kind: CalendarEntryKind;
  from: Date;
  to: Date;
  note: string | null;
};

const rangeOf = (from: Date, to: Date) =>
  sql`tstzrange(${from.toISOString()}::timestamptz, ${to.toISOString()}::timestamptz, '[)')`;

/** The owner's active calendar entries overlapping [from, to) (owner or admin; RLS). */
export async function getCalendarEntries(
  userId: string,
  aircraftId: string,
  from: Date,
  to: Date,
): Promise<CalendarItem[]> {
  const rows = await asUser(userId, (tx) =>
    tx
      .select({
        id: calendarEntries.id,
        kind: calendarEntries.kind,
        note: calendarEntries.note,
        from: sql<string>`lower(${calendarEntries.period})`,
        to: sql<string>`upper(${calendarEntries.period})`,
      })
      .from(calendarEntries)
      .where(
        and(
          eq(calendarEntries.aircraftId, aircraftId),
          eq(calendarEntries.active, true),
          sql`${calendarEntries.period} && ${rangeOf(from, to)}`,
        ),
      )
      .orderBy(asc(sql`lower(${calendarEntries.period})`))
      .limit(500),
  );
  return rows.map((r) => ({ ...r, from: new Date(r.from), to: new Date(r.to) }));
}

/** When a visible aircraft is busy within [from, to): periods only (SRC-4). */
export async function getBusyPeriods(
  viewerId: string | null,
  aircraftId: string,
  from: Date,
  to: Date,
): Promise<{ from: Date; to: Date }[]> {
  const query = (tx: Tx) =>
    tx.execute(sql`
      select lower(period) as "from", upper(period) as "to"
      from public.aircraft_busy_periods(${aircraftId}::uuid, ${rangeOf(from, to)})`) as unknown as Promise<
      { from: string; to: string }[]
    >;
  const rows = viewerId ? await asUser(viewerId, query) : await asAnon(query);
  return rows.map((r) => ({ from: new Date(r.from), to: new Date(r.to) }));
}
