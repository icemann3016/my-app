import "server-only";

import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/lib/db";
import {
  adminActions,
  aircraft,
  messages,
  profiles,
  reports,
  reviews,
  userRoles,
  users,
  type ReportStatus,
  type ReportTarget,
} from "@/lib/db/schema";

// Read-only admin views (ADM-2, ADM-3). Trusted code: callers must have called requireAdmin().

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export type ReportTargetView =
  | {
      type: "review";
      id: string;
      comment: string | null;
      overall: number;
      hidden: boolean;
      authorId: string | null;
      authorName: string | null;
      aircraftId: string | null;
    }
  | {
      type: "message";
      id: string;
      body: string;
      senderId: string | null;
      senderName: string | null;
    }
  | { type: "user"; id: string; name: string; suspended: boolean }
  | {
      type: "aircraft";
      id: string;
      registration: string;
      status: string;
      unlistedReason: string | null;
      ownerId: string;
      ownerName: string | null;
    };

/** Reports with what they point at, oldest open first (ADM-3). */
export async function listReports(status: ReportStatus) {
  const db = getDb();
  const reporter = alias(profiles, "reporter");
  const rows = await db
    .select({ r: reports, reporterName: reporter.displayName })
    .from(reports)
    .leftJoin(reporter, eq(reporter.id, reports.reporterId))
    .where(eq(reports.status, status))
    .orderBy(status === "open" ? reports.createdAt : desc(reports.resolvedAt))
    .limit(200);
  const ids = (t: ReportTarget) => [
    ...new Set(rows.filter((x) => x.r.targetType === t).map((x) => x.r.targetId)),
  ];
  const author = alias(profiles, "author");
  const [rv, ms, us, ac] = await Promise.all([
    ids("review").length
      ? db
          .select({ r: reviews, name: author.displayName })
          .from(reviews)
          .leftJoin(author, eq(author.id, reviews.authorId))
          .where(inArray(reviews.id, ids("review")))
      : [],
    ids("message").length
      ? db
          .select({ m: messages, name: author.displayName })
          .from(messages)
          .leftJoin(author, eq(author.id, messages.senderId))
          .where(inArray(messages.id, ids("message")))
      : [],
    ids("user").length
      ? db
          .select()
          .from(profiles)
          .where(inArray(profiles.id, ids("user")))
      : [],
    ids("aircraft").length
      ? db
          .select({ a: aircraft, name: author.displayName })
          .from(aircraft)
          .leftJoin(author, eq(author.id, aircraft.ownerId))
          .where(inArray(aircraft.id, ids("aircraft")))
      : [],
  ]);
  const targets = new Map<string, ReportTargetView>();
  for (const { r, name } of rv)
    targets.set(r.id, {
      type: "review",
      id: r.id,
      comment: r.comment,
      overall: r.overall,
      hidden: Boolean(r.hiddenAt),
      authorId: r.authorId,
      authorName: name,
      aircraftId: r.subjectAircraftId,
    });
  for (const { m, name } of ms)
    targets.set(m.id, {
      type: "message",
      id: m.id,
      body: m.body,
      senderId: m.senderId,
      senderName: name,
    });
  for (const p of us)
    targets.set(p.id, {
      type: "user",
      id: p.id,
      name: p.displayName,
      suspended: Boolean(p.suspendedAt),
    });
  for (const { a, name } of ac)
    targets.set(a.id, {
      type: "aircraft",
      id: a.id,
      registration: a.registration,
      status: a.status,
      unlistedReason: a.unlistedReason,
      ownerId: a.ownerId,
      ownerName: name,
    });
  return rows.map(({ r, reporterName }) => ({
    ...r,
    reporterName,
    target: targets.get(r.targetId) ?? null,
  }));
}

/** Users by name or email, with roles and suspension (ADM-2). */
export async function searchUsers(q: string) {
  const rows = await getDb()
    .select({
      id: profiles.id,
      name: profiles.displayName,
      email: users.email,
      suspendedAt: profiles.suspendedAt,
      createdAt: profiles.createdAt,
      roles: sql<string[]>`coalesce((select array_agg(r.role::text order by r.role)
        from ${userRoles} r where r.user_id = ${profiles.id}), '{}')`,
    })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.id))
    .where(q ? or(ilike(profiles.displayName, like(q)), ilike(users.email, like(q))) : undefined)
    .orderBy(desc(profiles.createdAt))
    .limit(50);
  return rows;
}

/** Aircraft by registration, make or model (ADM-2). */
export async function searchAircraft(q: string) {
  return getDb()
    .select({
      id: aircraft.id,
      registration: aircraft.registration,
      manufacturer: aircraft.manufacturer,
      model: aircraft.model,
      status: aircraft.status,
      unlistedReason: aircraft.unlistedReason,
      ownerId: aircraft.ownerId,
      ownerName: profiles.displayName,
    })
    .from(aircraft)
    .innerJoin(profiles, eq(profiles.id, aircraft.ownerId))
    .where(
      and(
        sql`${aircraft.status} <> 'draft'`,
        q
          ? or(
              ilike(aircraft.registration, like(q)),
              ilike(aircraft.manufacturer, like(q)),
              ilike(aircraft.model, like(q)),
            )
          : undefined,
      ),
    )
    .orderBy(aircraft.registration)
    .limit(50);
}

/** The audit log, newest first, filtered by action, target or reason (ADM-2). */
export async function auditLog(q: string) {
  const admin = alias(profiles, "admin");
  return getDb()
    .select({
      id: adminActions.id,
      action: adminActions.action,
      targetType: adminActions.targetType,
      targetId: adminActions.targetId,
      reason: adminActions.reason,
      createdAt: adminActions.createdAt,
      adminName: admin.displayName,
    })
    .from(adminActions)
    .leftJoin(admin, eq(admin.id, adminActions.adminId))
    .where(
      q
        ? or(
            ilike(adminActions.action, like(q)),
            ilike(adminActions.targetType, like(q)),
            ilike(adminActions.targetId, like(q)),
            ilike(adminActions.reason, like(q)),
            ilike(admin.displayName, like(q)),
          )
        : undefined,
    )
    .orderBy(desc(adminActions.createdAt))
    .limit(200);
}
