import { eq } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";

import { describeDb, prepareDatabase } from "./setup";

let db: typeof import("@/lib/db");
let rls: typeof import("@/lib/db/rls");
let s: typeof import("@/lib/db/schema");
let docs: typeof import("@/lib/documents");
let storage: typeof import("@/lib/storage");

const DAVE = "dddddddd-4444-4444-8444-444444444444"; // pilot
const ERIN = "eeeeeeee-5555-4555-8555-555555555555"; // admin
const FRED = "ffffffff-6666-4666-8666-666666666666"; // someone else

const pdf = (name = "licence.pdf") =>
  new File([new TextEncoder().encode("%PDF-1.4\n%test\n")], name, { type: "application/pdf" });

describeDb("private documents", () => {
  beforeAll(async () => {
    await prepareDatabase();
    process.env.STORAGE_DRIVER = "local";
    db = await import("@/lib/db");
    rls = await import("@/lib/db/rls");
    s = await import("@/lib/db/schema");
    docs = await import("@/lib/documents");
    storage = await import("@/lib/storage");
    await db
      .getDb()
      .insert(s.users)
      .values([
        { id: DAVE, name: "Dave", email: "dave-d@example.com" },
        { id: ERIN, name: "Erin", email: "erin-d@example.com" },
        { id: FRED, name: "Fred", email: "fred-d@example.com" },
      ]);
    await db.getDb().insert(s.userRoles).values({ userId: ERIN, role: "admin" });
  }, 60_000);

  it("stores a checked upload and refuses files that aren't PDFs or images", async () => {
    const ok = await docs.saveDocument(DAVE, pdf("../../scan.PDF"));
    expect(ok).toMatchObject({ ok: true, filename: "scan.pdf" });
    const html = new File(["<html><script>alert(1)</script>"], "x.pdf", {
      type: "application/pdf",
    });
    expect(await docs.saveDocument(DAVE, html)).toEqual({ ok: false, error: "invalidType" });
  });

  it("lets the owner and admins read a document; admin views are logged", async () => {
    const up = await docs.saveDocument(DAVE, pdf());
    if (!up.ok) throw new Error("upload failed");
    expect((await docs.readDocument(DAVE, up.id))?.doc.filename).toBe("licence.pdf");
    expect(await docs.readDocument(FRED, up.id)).toBeNull();
    expect(await docs.readDocument(ERIN, up.id)).not.toBeNull();
    const log = await db
      .getDb()
      .select()
      .from(s.adminActions)
      .where(eq(s.adminActions.targetId, up.id));
    expect(log).toMatchObject([{ adminId: ERIN, action: "document.view" }]);
  });

  it("deletes a document only once no credential uses it", async () => {
    const up = await docs.saveDocument(DAVE, pdf());
    if (!up.ok) throw new Error("upload failed");
    const [licence] = await rls.asUser(DAVE, (tx) =>
      tx
        .insert(s.pilotLicences)
        .values({
          userId: DAVE,
          type: "ppl_a",
          issuingState: "DE",
          number: "DE.1",
          documentId: up.id,
        })
        .returning(),
    );
    await docs.deleteDocumentIfUnused(DAVE, up.id);
    expect(await docs.readDocument(DAVE, up.id)).not.toBeNull(); // still attached

    await rls.asUser(DAVE, (tx) =>
      tx.delete(s.pilotLicences).where(eq(s.pilotLicences.id, licence!.id)),
    );
    const [row] = await db.getDb().select().from(s.documents).where(eq(s.documents.id, up.id));
    await docs.deleteDocumentIfUnused(DAVE, up.id);
    expect(await docs.readDocument(DAVE, up.id)).toBeNull();
    expect(await storage.getStorage("private").get(row!.storageKey)).toBeNull();
  });

  it("cleans up old uploads that were never attached", async () => {
    const attached = await docs.saveDocument(DAVE, pdf());
    if (!attached.ok) throw new Error("upload failed");
    await rls.asUser(DAVE, (tx) =>
      tx.insert(s.medicals).values({
        userId: DAVE,
        class: "class2",
        issuingState: "DE",
        validUntil: "2030-01-01",
        documentId: attached.id,
      }),
    );
    const removed = await docs.deleteOrphanDocuments(new Date(Date.now() + 60_000));
    expect(removed).toBeGreaterThan(0);
    const left = await db.getDb().select().from(s.documents).where(eq(s.documents.ownerId, DAVE));
    expect(left.map((d) => d.id)).toEqual([attached.id]);
  });
});
