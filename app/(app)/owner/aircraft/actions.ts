"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { DOCUMENT_PROBLEMS, nextSection } from "@/lib/aircraft/catalog";
import { listingProblems } from "@/lib/aircraft/queries";
import { requireProfile, requireUser } from "@/lib/auth/session";
import { pgError } from "@/lib/db/errors";
import { asUser } from "@/lib/db/rls";
import {
  aircraft,
  aircraftDocuments,
  aircraftFiles,
  aircraftPhotos,
  rentalRequirements,
} from "@/lib/db/schema";
import { deleteDocumentIfUnused } from "@/lib/documents";
import { type FormState, formValues } from "@/lib/forms";
import { localizedFieldErrors } from "@/lib/i18n/server";
import { getStorage } from "@/lib/storage";
import { massToKg, volumeToLitres } from "@/lib/units";
import { getUserUnits } from "@/lib/units-server";
import {
  aircraftDocumentSchema,
  aircraftFileSchema,
  baseSchema,
  detailsSchema,
  equipmentSchema,
  pricingSchema,
  requirementsSchema,
} from "@/lib/validation/aircraft";

const LIST = "/owner/aircraft";
const uuid = z.uuid();

function refresh(id?: string) {
  revalidatePath(LIST, "layout");
  if (id) revalidatePath(`/aircraft/${id}`);
}

/** Converts the details form (in the user's units) to database columns (SI). */
async function detailsColumns(data: z.infer<typeof detailsSchema>) {
  const units = await getUserUnits();
  const { fuelBurn, usefulLoad, ...rest } = data;
  return {
    ...rest,
    fuelBurnLph: fuelBurn === null ? null : volumeToLitres(fuelBurn, units),
    usefulLoadKg: usefulLoad === null ? null : massToKg(usefulLoad, units),
  };
}

/** Step 1 for a new aircraft: creates the draft and moves on to the next section. */
export async function createAircraft(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId, roles } = await requireProfile(`${LIST}/new`);
  if (!roles.includes("owner")) redirect(LIST);
  const raw = formValues(formData);
  const parsed = detailsSchema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };

  const columns = await detailsColumns(parsed.data);
  const id = await asUser(userId, async (tx) => {
    const [row] = await tx
      .insert(aircraft)
      .values({ ...columns, ownerId: userId })
      .returning({ id: aircraft.id });
    await tx.insert(rentalRequirements).values({ aircraftId: row!.id });
    return row!.id;
  });
  refresh();
  redirect(`${LIST}/${id}/equipment`);
}

const sectionSchemas = {
  details: detailsSchema,
  equipment: equipmentSchema,
  base: baseSchema,
  pricing: pricingSchema,
} as const;

/** Save one section of the listing. "Save and continue" (intent=next) opens the next section. */
export async function saveSection(
  section: keyof typeof sectionSchemas,
  aircraftId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser(`${LIST}/${aircraftId}/${section}`);
  const t = await getTranslations("owner.editor");
  const raw = formValues(formData);
  const parsed = sectionSchemas[section].safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };

  const values =
    section === "details"
      ? await detailsColumns(parsed.data as z.infer<typeof detailsSchema>)
      : parsed.data;
  try {
    const updated = await asUser(user.id, (tx) =>
      tx
        .update(aircraft)
        .set(values as Partial<typeof aircraft.$inferInsert>)
        .where(and(eq(aircraft.id, uuid.parse(aircraftId)), eq(aircraft.ownerId, user.id)))
        .returning({ id: aircraft.id }),
    );
    if (!updated.length) return { message: t("notFound"), values: raw };
  } catch (e) {
    const { code, hint } = pgError(e);
    if (hint === "registration_locked") {
      const v = await getTranslations("validation");
      return { errors: { registration: [v("registrationLocked")] }, values: raw };
    }
    if (code === "23503") {
      const v = await getTranslations("validation");
      return { errors: { homeAirportIdent: [v("airportUnknown")] }, values: raw };
    }
    throw e;
  }
  refresh(aircraftId);
  if (formData.get("intent") === "next") {
    const next = nextSection(section);
    redirect(next ? `${LIST}/${aircraftId}/${next}` : `${LIST}/${aircraftId}`);
  }
  return { ok: true, message: t("saved"), values: raw };
}

const statusSchema = z.object({
  id: z.uuid(),
  action: z.enum(["publish", "pause", "unlist", "cancelPublish"]),
});

/**
 * Publish, pause or unlist. Publishing lists the aircraft right away when everything is ready;
 * if only the document check is missing, it goes live automatically once an admin verifies them.
 */
export async function changeStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser(LIST);
  const t = await getTranslations("owner.status");
  const { id, action } = statusSchema.parse(formValues(formData));

  const result = await asUser(user.id, async (tx) => {
    const [a] = await tx
      .select({ status: aircraft.status })
      .from(aircraft)
      .where(and(eq(aircraft.id, id), eq(aircraft.ownerId, user.id)));
    if (!a) return "notFound" as const;
    const set = (values: Partial<typeof aircraft.$inferInsert>) =>
      tx.update(aircraft).set(values).where(eq(aircraft.id, id));

    if (action === "pause") return (await set({ status: "paused" }), "paused" as const);
    if (action === "unlist") return (await set({ status: "unlisted" }), "unlisted" as const);
    if (action === "cancelPublish") {
      return (await set({ publishRequestedAt: null }), "publishCancelled" as const);
    }
    const problems = await listingProblems(tx, id);
    if (problems.length === 0) return (await set({ status: "listed" }), "listed" as const);
    const onlyDocuments = problems.every((p) =>
      (DOCUMENT_PROBLEMS as readonly string[]).includes(p),
    );
    if (onlyDocuments) {
      return (await set({ publishRequestedAt: new Date() }), "publishRequested" as const);
    }
    return "incomplete" as const;
  });

  refresh(id);
  if (result === "notFound" || result === "incomplete") return { message: t(result) };
  return { ok: true, message: t(result) };
}

/** Delete a draft, paused or unlisted aircraft with its photos and documents. */
export async function deleteAircraft(formData: FormData) {
  const user = await requireUser(LIST);
  const id = uuid.parse(formData.get("id"));
  const removed = await asUser(user.id, async (tx) => {
    const photos = await tx
      .select({ key: aircraftPhotos.storageKey })
      .from(aircraftPhotos)
      .where(eq(aircraftPhotos.aircraftId, id));
    const docs = await tx
      .select({ documentId: aircraftDocuments.documentId })
      .from(aircraftDocuments)
      .where(eq(aircraftDocuments.aircraftId, id));
    const files = await tx
      .select({ documentId: aircraftFiles.documentId })
      .from(aircraftFiles)
      .where(eq(aircraftFiles.aircraftId, id));
    const deleted = await tx
      .delete(aircraft)
      .where(and(eq(aircraft.id, id), eq(aircraft.ownerId, user.id)))
      .returning({ id: aircraft.id });
    if (!deleted.length) return null;
    return {
      photoKeys: photos.map((p) => p.key),
      documentIds: [...docs, ...files].map((d) => d.documentId),
    };
  });
  if (removed) {
    for (const key of removed.photoKeys) {
      await getStorage()
        .delete(key)
        .catch((e) => console.warn("[aircraft] couldn't delete photo", e));
    }
    for (const docId of removed.documentIds) await deleteDocumentIfUnused(user.id, docId);
  }
  refresh(id);
  redirect(LIST);
}

// Photos ---------------------------------------------------------------------------------

/** Move a photo one place earlier or later; the first photo is the cover. */
export async function movePhoto(formData: FormData) {
  const user = await requireUser(LIST);
  const aircraftId = uuid.parse(formData.get("aircraftId"));
  const photoId = uuid.parse(formData.get("photoId"));
  const direction = z.enum(["up", "down", "cover"]).parse(formData.get("direction"));
  await asUser(user.id, async (tx) => {
    const photos = await tx
      .select({ id: aircraftPhotos.id })
      .from(aircraftPhotos)
      .where(eq(aircraftPhotos.aircraftId, aircraftId))
      .orderBy(aircraftPhotos.sortOrder, aircraftPhotos.createdAt);
    const order = photos.map((p) => p.id);
    const i = order.indexOf(photoId);
    if (i === -1) return;
    const [moved] = order.splice(i, 1);
    const target = direction === "cover" ? 0 : direction === "up" ? Math.max(0, i - 1) : i + 1;
    order.splice(Math.min(target, order.length), 0, moved!);
    for (const [sortOrder, id] of order.entries()) {
      await tx.update(aircraftPhotos).set({ sortOrder }).where(eq(aircraftPhotos.id, id));
    }
  });
  refresh(aircraftId);
}

export async function deletePhoto(formData: FormData) {
  const user = await requireUser(LIST);
  const aircraftId = uuid.parse(formData.get("aircraftId"));
  const photoId = uuid.parse(formData.get("photoId"));
  const deleted = await asUser(user.id, (tx) =>
    tx
      .delete(aircraftPhotos)
      .where(and(eq(aircraftPhotos.id, photoId), eq(aircraftPhotos.aircraftId, aircraftId)))
      .returning({ key: aircraftPhotos.storageKey }),
  );
  for (const { key } of deleted) {
    await getStorage()
      .delete(key)
      .catch((e) => console.warn("[aircraft] couldn't delete photo", e));
  }
  refresh(aircraftId);
}

// Documents (CofA, ARC, insurance) and reference files ------------------------------------

export async function saveAircraftDocument(
  aircraftId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser(`${LIST}/${aircraftId}/documents`);
  const t = await getTranslations("owner.documents");
  const raw = formValues(formData);
  const parsed = aircraftDocumentSchema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };
  const { id, kind, expiresOn, documentId } = parsed.data;

  let replaced: string | null = null;
  try {
    const ok = await asUser(user.id, async (tx) => {
      if (id) {
        const [existing] = await tx
          .select({ documentId: aircraftDocuments.documentId })
          .from(aircraftDocuments)
          .where(and(eq(aircraftDocuments.id, id), eq(aircraftDocuments.aircraftId, aircraftId)));
        if (!existing) return false;
        await tx
          .update(aircraftDocuments)
          .set({ expiresOn, documentId })
          .where(eq(aircraftDocuments.id, id));
        if (existing.documentId !== documentId) replaced = existing.documentId;
        return true;
      }
      await tx
        .insert(aircraftDocuments)
        .values({ aircraftId: uuid.parse(aircraftId), kind, expiresOn, documentId });
      return true;
    });
    if (!ok) return { message: t("notFound"), values: raw };
  } catch (e) {
    if (pgError(e).code === "42501") {
      const v = await getTranslations("validation");
      return { errors: { documentId: [v("documentInvalid")] }, values: raw };
    }
    throw e;
  }
  await deleteDocumentIfUnused(user.id, replaced);
  refresh(aircraftId);
  return { ok: true, message: t("saved") };
}

export async function deleteAircraftDocument(formData: FormData) {
  const user = await requireUser(LIST);
  const aircraftId = uuid.parse(formData.get("aircraftId"));
  const id = uuid.parse(formData.get("id"));
  const deleted = await asUser(user.id, (tx) =>
    tx
      .delete(aircraftDocuments)
      .where(and(eq(aircraftDocuments.id, id), eq(aircraftDocuments.aircraftId, aircraftId)))
      .returning({ documentId: aircraftDocuments.documentId }),
  );
  for (const d of deleted) await deleteDocumentIfUnused(user.id, d.documentId);
  refresh(aircraftId);
}

export async function addAircraftFile(
  aircraftId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser(`${LIST}/${aircraftId}/documents`);
  const t = await getTranslations("owner.files");
  const raw = formValues(formData);
  const parsed = aircraftFileSchema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };
  try {
    await asUser(user.id, (tx) =>
      tx.insert(aircraftFiles).values({ ...parsed.data, aircraftId: uuid.parse(aircraftId) }),
    );
  } catch (e) {
    if (pgError(e).code === "42501") {
      const v = await getTranslations("validation");
      return { errors: { documentId: [v("documentInvalid")] }, values: raw };
    }
    throw e;
  }
  refresh(aircraftId);
  return { ok: true, message: t("saved") };
}

export async function deleteAircraftFile(formData: FormData) {
  const user = await requireUser(LIST);
  const aircraftId = uuid.parse(formData.get("aircraftId"));
  const id = uuid.parse(formData.get("id"));
  const deleted = await asUser(user.id, (tx) =>
    tx
      .delete(aircraftFiles)
      .where(and(eq(aircraftFiles.id, id), eq(aircraftFiles.aircraftId, aircraftId)))
      .returning({ documentId: aircraftFiles.documentId }),
  );
  for (const d of deleted) await deleteDocumentIfUnused(user.id, d.documentId);
  refresh(aircraftId);
}

// Rental requirements -------------------------------------------------------------------

export async function saveRequirements(
  aircraftId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser(`${LIST}/${aircraftId}/requirements`);
  const t = await getTranslations("owner.editor");
  const raw = formValues(formData);
  const parsed = requirementsSchema.safeParse({
    ...raw,
    licenceTypes: formData.getAll("licenceTypes"),
    requiredRatings: formData
      .getAll("requiredRatings")
      .map(String)
      .concat(
        String(formData.get("typeRatings") ?? "")
          .split(/[\s,;]+/)
          .filter(Boolean),
      ),
  });
  if (!parsed.success) {
    const errors = await localizedFieldErrors(parsed.error);
    // Wrong type designators are reported on the text field.
    if (errors.requiredRatings) errors.typeRatings = errors.requiredRatings;
    return { errors, values: raw };
  }
  const values = { ...parsed.data, requiredRatings: [...new Set(parsed.data.requiredRatings)] };
  const id = uuid.parse(aircraftId);
  const saved = await asUser(user.id, async (tx) => {
    const [a] = await tx
      .select({ id: aircraft.id })
      .from(aircraft)
      .where(and(eq(aircraft.id, id), eq(aircraft.ownerId, user.id)));
    if (!a) return false;
    await tx
      .insert(rentalRequirements)
      .values({ aircraftId: id, ...values })
      .onConflictDoUpdate({ target: rentalRequirements.aircraftId, set: values });
    return true;
  });
  if (!saved) return { message: t("notFound"), values: raw };
  refresh(aircraftId);
  if (formData.get("intent") === "next") redirect(`${LIST}/${aircraftId}`);
  return { ok: true, message: t("saved"), values: raw };
}
