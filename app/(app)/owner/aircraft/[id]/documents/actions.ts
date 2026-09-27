"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import type { Tx } from "@/lib/db";
import { asUser } from "@/lib/db/rls";
import { aircraft, aircraftDocuments } from "@/lib/db/schema";
import { deleteDocumentIfUnused } from "@/lib/documents";
import { type FormState, formValues } from "@/lib/forms";
import { localizedFieldErrors } from "@/lib/i18n/server";
import { aircraftDocumentSchema } from "@/lib/validation/aircraft";

class NotFound extends Error {}
/** The change would leave a listed aircraft without a valid ARC or insurance. */
class WouldBreakListing extends Error {}

/** Postgres error code of a failed query (drizzle wraps the driver error). */
function pgCode(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } };
  return err.cause?.code ?? err.code;
}

/**
 * A listed aircraft must keep a valid, verified ARC and insurance: renewals are added as new
 * documents (the old one counts until the new one is verified).
 */
async function assertStillListable(tx: Tx, aircraftId: string) {
  const [row] = (await tx.execute(sql`
    select a.status, public.aircraft_listing_gaps(a.id) as gaps
    from ${aircraft} a where a.id = ${aircraftId}`)) as unknown as {
    status: string;
    gaps: string[];
  }[];
  if (row?.status === "listed" && row.gaps.some((g) => g === "arc" || g === "insurance")) {
    throw new WouldBreakListing();
  }
}

function refresh(aircraftId: string) {
  revalidatePath(`/owner/aircraft/${aircraftId}`, "layout");
  revalidatePath("/owner/aircraft");
  revalidatePath("/admin/verifications");
}

/** Add or change a document of the user's aircraft. RLS checks the aircraft and the upload. */
export async function saveAircraftDocument(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/owner/aircraft");
  const t = await getTranslations("aircraft.documents");
  const raw = formValues(formData);
  const parsed = aircraftDocumentSchema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };
  const { id, aircraftId, kind, title, expiresOn, documentId } = parsed.data;

  let replaced: string | null = null;
  try {
    await asUser(user.id, async (tx) => {
      const [own] = await tx
        .select({ id: aircraft.id })
        .from(aircraft)
        .where(and(eq(aircraft.id, aircraftId), eq(aircraft.ownerId, user.id)));
      if (!own) throw new NotFound();
      if (id) {
        const mine = and(
          eq(aircraftDocuments.id, id),
          eq(aircraftDocuments.aircraftId, aircraftId),
        );
        const [existing] = await tx
          .select({ documentId: aircraftDocuments.documentId })
          .from(aircraftDocuments)
          .where(mine);
        if (!existing) throw new NotFound();
        await tx.update(aircraftDocuments).set({ title, expiresOn, documentId }).where(mine);
        if (existing.documentId !== documentId) replaced = existing.documentId;
        await assertStillListable(tx, aircraftId);
      } else {
        const verified = kind === "cofa" || kind === "arc" || kind === "insurance";
        await tx.insert(aircraftDocuments).values({
          aircraftId,
          kind,
          title,
          expiresOn,
          documentId,
          status: verified ? "pending" : null,
        });
      }
    });
  } catch (e) {
    if (e instanceof NotFound) return { message: t("notFound"), values: raw };
    if (e instanceof WouldBreakListing) return { message: t("addRenewal"), values: raw };
    if (pgCode(e) === "42501") {
      const v = await getTranslations("validation");
      return { errors: { documentId: [v("documentInvalid")] }, values: raw };
    }
    throw e;
  }
  await deleteDocumentIfUnused(user.id, replaced);
  refresh(aircraftId);
  return { ok: true, message: t("saved") };
}

const deleteSchema = z.object({ aircraftId: z.uuid(), id: z.uuid() });

/** Delete an aircraft document and its file (if nothing else uses it). */
export async function deleteAircraftDocument(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/owner/aircraft");
  const t = await getTranslations("aircraft.documents");
  const { aircraftId, id } = deleteSchema.parse(formValues(formData));
  let deleted: { documentId: string }[] = [];
  try {
    deleted = await asUser(user.id, async (tx) => {
      const rows = await tx
        .delete(aircraftDocuments)
        .where(and(eq(aircraftDocuments.id, id), eq(aircraftDocuments.aircraftId, aircraftId)))
        .returning({ documentId: aircraftDocuments.documentId });
      await assertStillListable(tx, aircraftId);
      return rows;
    });
  } catch (e) {
    if (e instanceof WouldBreakListing) return { message: t("cantDeleteListed") };
    throw e;
  }
  for (const row of deleted) await deleteDocumentIfUnused(user.id, row.documentId);
  refresh(aircraftId);
  return { ok: true };
}
