"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { type ListingGap, nextSection, type Section, STATUS_ACTIONS } from "@/lib/aircraft/catalog";
import { deletePhotoFiles } from "@/lib/aircraft/photos";
import { getUnits } from "@/lib/aircraft/queries";
import { requireProfile, requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db/rls";
import { aircraft, aircraftDocuments, aircraftPhotos } from "@/lib/db/schema";
import { deleteDocumentIfUnused } from "@/lib/documents";
import { type FormState, formValues } from "@/lib/forms";
import { localizedFieldErrors } from "@/lib/i18n/server";
import {
  baseSchema,
  detailsSchema,
  equipmentSchema,
  pricingSchema,
} from "@/lib/validation/aircraft";

const BASE = "/owner/aircraft";
const idSchema = z.uuid();

/** Postgres error code and detail of a failed query (drizzle wraps the driver error). */
function pgError(e: unknown): { code?: string; detail?: string } {
  const err = e as { code?: string; detail?: string; cause?: { code?: string; detail?: string } };
  return { code: err.cause?.code ?? err.code, detail: err.cause?.detail ?? err.detail };
}

/** Friendly errors for database constraints the forms can run into. */
async function constraintErrors(e: unknown): Promise<FormState["errors"] | null> {
  const { code } = pgError(e);
  const v = await getTranslations("validation");
  if (code === "23505") return { registration: [v("registrationTaken")] };
  if (code === "23503") return { homeAirport: [v("airportUnknown")] };
  return null;
}

function refresh(id: string) {
  revalidatePath(BASE);
  revalidatePath(`${BASE}/${id}`, "layout");
  revalidatePath(`/aircraft/${id}`);
}

/** Step 1 of a new listing: creates the draft and continues with the next section. */
export async function createAircraft(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId, roles } = await requireProfile(`${BASE}/new`);
  const t = await getTranslations("aircraft.edit");
  if (!roles.includes("owner")) return { message: t("ownerRoleNeeded") };
  const raw = formValues(formData);
  const parsed = detailsSchema(await getUnits(userId)).safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };

  const [row] = await asUser(userId, (tx) =>
    tx
      .insert(aircraft)
      .values({ ...parsed.data, ownerId: userId })
      .returning({ id: aircraft.id }),
  );
  revalidatePath(BASE);
  redirect(`${BASE}/${row!.id}/${nextSection("details")}`);
}

type Values = Partial<typeof aircraft.$inferInsert>;

/**
 * Save one section of the user's aircraft. Drafts continue with the next setup step; saved
 * changes to other aircraft stay on the page with a message.
 */
async function saveSection(
  section: Section,
  formData: FormData,
  parse: (raw: Record<string, string>, userId: string) => Promise<z.ZodSafeParseResult<Values>>,
): Promise<FormState> {
  const user = await requireUser(BASE);
  const t = await getTranslations("aircraft.edit");
  const raw = formValues(formData);
  const id = idSchema.safeParse(raw.id);
  if (!id.success) return { message: t("notFound") };
  const parsed = await parse(raw, user.id);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };

  let status: string | undefined;
  try {
    const rows = await asUser(user.id, (tx) =>
      tx
        .update(aircraft)
        .set(parsed.data)
        .where(and(eq(aircraft.id, id.data), eq(aircraft.ownerId, user.id)))
        .returning({ status: aircraft.status }),
    );
    status = rows[0]?.status;
  } catch (e) {
    const errors = await constraintErrors(e);
    if (errors) return { errors, values: raw };
    throw e;
  }
  if (!status) return { message: t("notFound") };
  refresh(id.data);
  const next = nextSection(section);
  if (status === "draft" && next) redirect(`${BASE}/${id.data}/${next}`);
  return { ok: true, message: t("saved"), values: raw };
}

export async function saveDetails(_prev: FormState, formData: FormData) {
  return saveSection("details", formData, async (raw, userId) =>
    detailsSchema(await getUnits(userId)).safeParse(raw),
  );
}

export async function saveEquipment(_prev: FormState, formData: FormData) {
  return saveSection("equipment", formData, async (raw) => equipmentSchema.safeParse(raw));
}

export async function saveBase(_prev: FormState, formData: FormData) {
  return saveSection("base", formData, async (raw) => baseSchema.safeParse(raw));
}

export async function savePricing(_prev: FormState, formData: FormData) {
  return saveSection("pricing", formData, async (raw) => pricingSchema.safeParse(raw));
}

const statusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["listed", "paused", "unlisted"]),
});

/** List, pause or unlist an aircraft (LST-7). The database checks it's ready to be listed. */
export async function setAircraftStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser(BASE);
  const t = await getTranslations("aircraft.status");
  const parsed = statusSchema.safeParse(formValues(formData));
  if (!parsed.success) return { message: t("failed") };
  const { id, status } = parsed.data;

  const current = await asUser(user.id, async (tx) => {
    const [row] = await tx
      .select({ status: aircraft.status })
      .from(aircraft)
      .where(and(eq(aircraft.id, id), eq(aircraft.ownerId, user.id)));
    return row?.status;
  });
  if (!current || !STATUS_ACTIONS[current].includes(status)) return { message: t("failed") };

  try {
    await asUser(user.id, (tx) =>
      tx
        .update(aircraft)
        .set({ status })
        .where(and(eq(aircraft.id, id), eq(aircraft.ownerId, user.id))),
    );
  } catch (e) {
    const { code, detail } = pgError(e);
    if (code === "23514" && detail) {
      const gaps = await getTranslations("aircraft.gaps");
      const missing = detail.split(",").map((g) => gaps(g as ListingGap));
      return { message: t("notReady", { missing: missing.join(", ") }) };
    }
    if (code === "23505") return { message: t("registrationTaken") };
    throw e;
  }
  refresh(id);
  return { ok: true, message: t(`done.${status}`) };
}

/** Delete an aircraft with its photos and documents. */
export async function deleteAircraft(formData: FormData) {
  const user = await requireUser(BASE);
  const id = idSchema.parse(formData.get("id"));
  const { photos, documentIds } = await asUser(user.id, async (tx) => {
    const photos = await tx
      .select({ key: aircraftPhotos.storageKey })
      .from(aircraftPhotos)
      .where(eq(aircraftPhotos.aircraftId, id));
    const docs = await tx
      .select({ documentId: aircraftDocuments.documentId })
      .from(aircraftDocuments)
      .where(eq(aircraftDocuments.aircraftId, id));
    const deleted = await tx
      .delete(aircraft)
      .where(and(eq(aircraft.id, id), eq(aircraft.ownerId, user.id)))
      .returning({ id: aircraft.id });
    return deleted.length
      ? { photos: photos.map((p) => p.key), documentIds: docs.map((d) => d.documentId) }
      : { photos: [], documentIds: [] };
  });
  await deletePhotoFiles(photos);
  for (const documentId of new Set(documentIds)) await deleteDocumentIfUnused(user.id, documentId);
  revalidatePath(BASE);
  redirect(BASE);
}
