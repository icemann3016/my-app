import { eq } from "drizzle-orm";
import { beforeAll, expect, it, vi } from "vitest";

import { describeDb, prepareDatabase } from "./setup";

let db: typeof import("@/lib/db");
let s: typeof import("@/lib/db/schema");
let admin: typeof import("@/lib/admin/verifications");
let reminders: typeof import("@/lib/pilot/reminders");

const GINA = "99999999-7777-4777-8777-777777777777"; // pilot
const HANK = "88888888-8888-4888-8888-888888888888"; // admin

const inDays = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

describeDb("admin review and expiry reminders", () => {
  beforeAll(async () => {
    await prepareDatabase();
    process.env.EMAIL_DRIVER = "console";
    db = await import("@/lib/db");
    s = await import("@/lib/db/schema");
    admin = await import("@/lib/admin/verifications");
    reminders = await import("@/lib/pilot/reminders");
    await db
      .getDb()
      .insert(s.users)
      .values([
        { id: GINA, name: "Gina", email: "gina-r@example.com" },
        { id: HANK, name: "Hank", email: "hank-r@example.com" },
      ]);
    await db.getDb().insert(s.userRoles).values({ userId: HANK, role: "admin" });
    await db
      .getDb()
      .update(s.userSettings)
      .set({ locale: "bg" })
      .where(eq(s.userSettings.userId, GINA));
  }, 60_000);

  it("lists pilots with pending items and lets another admin verify or reject them", async () => {
    const [licence] = await db
      .getDb()
      .insert(s.pilotLicences)
      .values({ userId: GINA, type: "ppl_a", issuingState: "BG", number: "BG.1" })
      .returning();
    const queue = await admin.getVerificationQueue(HANK);
    expect(queue).toMatchObject([{ userId: GINA, displayName: "Gina", items: 1 }]);

    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const result = await admin.reviewCredential({
      adminId: HANK,
      kind: "licence",
      id: licence!.id,
      version: licence!.updatedAt.toISOString(),
      decision: "reject",
      reason: "Номерът не съвпада.",
    });
    expect(result).toEqual({ ok: true, pilotId: GINA });
    const [row] = await db
      .getDb()
      .select()
      .from(s.pilotLicences)
      .where(eq(s.pilotLicences.id, licence!.id));
    expect(row).toMatchObject({
      status: "rejected",
      rejectionReason: "Номерът не съвпада.",
      reviewedBy: HANK,
    });
    // The pilot is emailed in their language.
    expect(info.mock.calls.flat().join("\n")).toContain("Причина: Номерът не съвпада.");
    info.mockRestore();

    const log = await admin.getReviewHistory(HANK, [licence!.id]);
    expect(log).toMatchObject([{ action: "credential.reject", adminName: "Hank" }]);
    expect(await admin.getVerificationQueue(HANK)).toEqual([]);
  });

  it("refuses stale reviews and reviews of your own credentials", async () => {
    const [licence] = await db
      .getDb()
      .insert(s.pilotLicences)
      .values({ userId: GINA, type: "lapl_a", issuingState: "BG", number: "BG.2" })
      .returning();
    const stale = await admin.reviewCredential({
      adminId: HANK,
      kind: "licence",
      id: licence!.id,
      version: new Date(licence!.updatedAt.getTime() - 5000).toISOString(),
      decision: "verify",
      reason: null,
    });
    expect(stale).toEqual({ ok: false, error: "changed" });

    const [own] = await db
      .getDb()
      .insert(s.medicals)
      .values({ userId: HANK, class: "class2", issuingState: "DE", validUntil: inDays(200) })
      .returning();
    const self = await admin.reviewCredential({
      adminId: HANK,
      kind: "medical",
      id: own!.id,
      version: own!.updatedAt.toISOString(),
      decision: "verify",
      reason: null,
    });
    expect(self).toEqual({ ok: false, error: "ownItem" });
  });

  it("reminds once about credentials that expire within 30 days", async () => {
    await db
      .getDb()
      .insert(s.medicals)
      .values([
        {
          userId: GINA,
          class: "class2",
          issuingState: "BG",
          validUntil: inDays(10),
          status: "verified",
        },
        {
          userId: GINA,
          class: "lapl",
          issuingState: "BG",
          validUntil: inDays(60),
          status: "verified",
        },
        {
          userId: GINA,
          class: "class1",
          issuingState: "BG",
          validUntil: inDays(5),
          status: "rejected",
        },
      ]);
    await db
      .getDb()
      .insert(s.pilotRatings)
      .values({ userId: GINA, kind: "class", code: "SEP_LAND", expiresOn: inDays(20) });

    const [medical] = await db
      .getDb()
      .select()
      .from(s.medicals)
      .where(eq(s.medicals.validUntil, inDays(10)));

    // Without a real email service in production nothing is sent, and nothing is marked as sent.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "production");
    expect(await reminders.sendExpiryReminders()).toEqual({ emails: 0, items: 2, notDelivered: 2 });
    vi.unstubAllEnvs();
    warn.mockRestore();

    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    expect(await reminders.sendExpiryReminders()).toEqual({ emails: 1, items: 2, notDelivered: 0 });
    const text = info.mock.calls.flat().join("\n");
    expect(text).toContain("Медицинско свидетелство (Клас 2)");
    expect(text).toContain("SEP (сухоземни)");
    expect(text).not.toContain("LAPL");
    expect(await reminders.sendExpiryReminders()).toEqual({ emails: 0, items: 0, notDelivered: 0 });
    info.mockRestore();

    // Reminder bookkeeping doesn't count as a change an admin must re-check.
    const [after] = await db
      .getDb()
      .select()
      .from(s.medicals)
      .where(eq(s.medicals.id, medical!.id));
    expect(after!.reminderSentAt).not.toBeNull();
    expect(after!.updatedAt).toEqual(medical!.updatedAt);
  });
});
