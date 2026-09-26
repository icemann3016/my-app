import { eq, sql } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";

import { describeDb, prepareDatabase } from "./setup";

let db: typeof import("@/lib/db");
let rls: typeof import("@/lib/db/rls");
let s: typeof import("@/lib/db/schema");

const ALICE = "aaaaaaaa-1111-4111-8111-111111111111"; // pilot
const BOB = "bbbbbbbb-2222-4222-8222-222222222222"; // another user
const CAROL = "cccccccc-3333-4333-8333-333333333333"; // admin
let aliceDoc: string;
let bobDoc: string;
let licenceId: string;

async function pgCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    return err.cause?.code ?? err.code;
  }
}

describeDb("pilot credentials security", () => {
  beforeAll(async () => {
    await prepareDatabase();
    db = await import("@/lib/db");
    rls = await import("@/lib/db/rls");
    s = await import("@/lib/db/schema");
    await db
      .getDb()
      .insert(s.users)
      .values([
        { id: ALICE, name: "Alice", email: "alice-p@example.com" },
        { id: BOB, name: "Bob", email: "bob-p@example.com" },
        { id: CAROL, name: "Carol", email: "carol-p@example.com" },
      ]);
    await db.getDb().insert(s.userRoles).values({ userId: CAROL, role: "admin" });

    const doc = (owner: string, key: string) =>
      rls.asUser(owner, (tx) =>
        tx
          .insert(s.documents)
          .values({
            ownerId: owner,
            storageKey: key,
            filename: "l.pdf",
            contentType: "application/pdf",
            sizeBytes: 10,
          })
          .returning({ id: s.documents.id }),
      );
    aliceDoc = (await doc(ALICE, `documents/${ALICE}/1.pdf`))[0]!.id;
    bobDoc = (await doc(BOB, `documents/${BOB}/1.pdf`))[0]!.id;
  }, 60_000);

  it("lets a pilot add a licence, which starts as pending", async () => {
    const [row] = await rls.asUser(ALICE, (tx) =>
      tx
        .insert(s.pilotLicences)
        .values({
          userId: ALICE,
          type: "ppl_a",
          issuingState: "BG",
          number: "BG.FCL.123",
          documentId: aliceDoc,
        })
        .returning(),
    );
    licenceId = row!.id;
    expect(row!.status).toBe("pending");
  });

  it("stops a pilot verifying their own credentials", async () => {
    expect(
      await pgCode(
        rls.asUser(ALICE, (tx) =>
          tx.insert(s.pilotLicences).values({
            userId: ALICE,
            type: "ppl_a",
            issuingState: "BG",
            number: "X",
            status: "verified",
          }),
        ),
      ),
    ).toBe("42501");
    expect(
      await pgCode(
        rls.asUser(ALICE, (tx) =>
          tx
            .update(s.pilotLicences)
            .set({ status: "verified" })
            .where(eq(s.pilotLicences.id, licenceId)),
        ),
      ),
    ).toBe("42501");
  });

  it("stops a pilot attaching someone else's document", async () => {
    expect(
      await pgCode(
        rls.asUser(ALICE, (tx) =>
          tx.insert(s.medicals).values({
            userId: ALICE,
            class: "class2",
            issuingState: "BG",
            validUntil: "2027-06-30",
            documentId: bobDoc,
          }),
        ),
      ),
    ).toBe("42501");
  });

  it("keeps credentials private from other users and visitors, but visible to admins", async () => {
    expect(await rls.asUser(BOB, (tx) => tx.select().from(s.pilotLicences))).toEqual([]);
    expect(await rls.asAnon((tx) => tx.select().from(s.pilotLicences))).toEqual([]);
    const updated = await rls.asUser(BOB, (tx) =>
      tx
        .update(s.pilotLicences)
        .set({ number: "hacked" })
        .where(eq(s.pilotLicences.id, licenceId))
        .returning(),
    );
    expect(updated).toEqual([]);
    const seenByAdmin = await rls.asUser(CAROL, (tx) => tx.select().from(s.pilotLicences));
    expect(seenByAdmin.map((l) => l.id)).toContain(licenceId);
  });

  it("only lets users register files in their own storage folder", async () => {
    expect(
      await pgCode(
        rls.asUser(BOB, (tx) =>
          tx.insert(s.documents).values({
            ownerId: BOB,
            storageKey: `documents/${ALICE}/1.pdf`,
            filename: "x.pdf",
            contentType: "application/pdf",
            sizeBytes: 1,
          }),
        ),
      ),
    ).toBe("42501");
  });

  it("keeps documents private: owner and admins only", async () => {
    expect(
      await rls.asUser(BOB, (tx) =>
        tx.select().from(s.documents).where(eq(s.documents.id, aliceDoc)),
      ),
    ).toEqual([]);
    expect(
      await rls.asUser(CAROL, (tx) =>
        tx.select().from(s.documents).where(eq(s.documents.id, aliceDoc)),
      ),
    ).toHaveLength(1);
    const deletedByBob = await rls.asUser(BOB, (tx) =>
      tx.delete(s.documents).where(eq(s.documents.id, aliceDoc)).returning(),
    );
    expect(deletedByBob).toEqual([]);
  });

  it("sends a verified credential back to review when the pilot edits it", async () => {
    // Admin verifies (trusted admin code uses the owner connection).
    await db
      .getDb()
      .update(s.pilotLicences)
      .set({ status: "verified", reviewedBy: CAROL, reviewedAt: new Date() })
      .where(eq(s.pilotLicences.id, licenceId));
    let [row] = await db
      .getDb()
      .select()
      .from(s.pilotLicences)
      .where(eq(s.pilotLicences.id, licenceId));
    expect(row!.status).toBe("verified");

    await rls.asUser(ALICE, (tx) =>
      tx
        .update(s.pilotLicences)
        .set({ number: "BG.FCL.999" })
        .where(eq(s.pilotLicences.id, licenceId)),
    );
    [row] = await db
      .getDb()
      .select()
      .from(s.pilotLicences)
      .where(eq(s.pilotLicences.id, licenceId));
    expect(row!.status).toBe("pending");
    expect(row!.reviewedBy).toBeNull();
  });

  it("keeps self-declared experience private", async () => {
    await rls.asUser(ALICE, (tx) =>
      tx
        .insert(s.pilotExperience)
        .values({ userId: ALICE, totalHours: 250, picHours: 200, last90DaysHours: 6 }),
    );
    expect(await rls.asUser(BOB, (tx) => tx.select().from(s.pilotExperience))).toEqual([]);
    expect(
      await pgCode(
        rls.asUser(ALICE, (tx) =>
          tx
            .update(s.pilotExperience)
            .set({ picHours: 999 })
            .where(eq(s.pilotExperience.userId, ALICE)),
        ),
      ),
    ).toBe("23514"); // PIC hours can't exceed total hours
  });

  it("shows the admin log to admins only", async () => {
    await db.getDb().insert(s.adminActions).values({
      adminId: CAROL,
      action: "document.view",
      targetType: "document",
      targetId: aliceDoc,
    });
    expect(await rls.asUser(ALICE, (tx) => tx.select().from(s.adminActions))).toEqual([]);
    expect(await rls.asUser(CAROL, (tx) => tx.select().from(s.adminActions))).toHaveLength(1);
  });

  it("shows only verified, unexpired licence types and ratings as public badges", async () => {
    await db
      .getDb()
      .update(s.pilotLicences)
      .set({ status: "verified" })
      .where(eq(s.pilotLicences.id, licenceId));
    await db
      .getDb()
      .insert(s.pilotRatings)
      .values([
        { userId: ALICE, kind: "class", code: "SEP_LAND", status: "verified" },
        {
          userId: ALICE,
          kind: "privilege",
          code: "NIGHT",
          status: "verified",
          expiresOn: "2001-01-01",
        },
        { userId: ALICE, kind: "privilege", code: "IR", status: "pending" },
      ]);
    const badges = (await rls.asAnon((tx) =>
      tx.execute(sql`select kind, code from public.pilot_badges(${ALICE}) order by kind, code`),
    )) as unknown as { kind: string; code: string }[];
    expect(badges.map((b) => `${b.kind}:${b.code}`)).toEqual(["class:SEP_LAND", "licence:ppl_a"]);
  });

  it("deletes credentials and documents with the user", async () => {
    await db.getDb().delete(s.users).where(eq(s.users.id, ALICE));
    const [{ count }] = (await db
      .getDb()
      .execute(
        sql`select (select count(*) from pilot_licences) + (select count(*) from documents where owner_id = ${ALICE}) as count`,
      )) as unknown as { count: string }[];
    expect(Number(count)).toBe(0);
  });
});
