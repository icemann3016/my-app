"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db/rls";
import {
  experienceByType,
  medicals,
  pilotExperience,
  pilotLicences,
  pilotRatings,
} from "@/lib/db/schema";
import { deleteDocumentIfUnused } from "@/lib/documents";
import { type FormState, formValues } from "@/lib/forms";
import { localizedFieldErrors } from "@/lib/i18n/server";
import type { CredentialKind } from "@/lib/pilot/labels";
import {
  experienceSchema,
  licenceSchema,
  medicalSchema,
  ratingSchema,
  typeHoursSchema,
} from "@/lib/validation/pilot";

const PATH = "/account/credentials";

const tables = { licence: pilotLicences, rating: pilotRatings, medical: medicals } as const;

/** Postgres error code of a failed query (drizzle wraps the driver error). */
function pgCode(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } };
  return err.cause?.code ?? err.code;
}

type Saved = { ok: true } | { ok: false; error: "notFound" | "documentInvalid" };

class NotFound extends Error {}

/**
 * Insert or update one credential for the logged-in user. RLS makes sure it's their own row and
 * their own document; the database resets the review when a verified item changes.
 */
async function saveCredential(
  userId: string,
  kind: CredentialKind,
  id: string | undefined,
  data: Record<string, unknown> & { documentId: string | null },
): Promise<Saved> {
  // The three tables share id, user_id and document_id; drizzle maps the other columns from the
  // real table at runtime, so typing it as one of them is safe here.
  const table = tables[kind] as typeof pilotLicences;
  const values = data as Partial<typeof pilotLicences.$inferInsert>;
  let replacedDocument: string | null = null;
  try {
    await asUser(userId, async (tx) => {
      const mine = id ? and(eq(table.id, id), eq(table.userId, userId)) : undefined;
      if (mine) {
        const [existing] = await tx
          .select({ documentId: table.documentId })
          .from(table)
          .where(mine);
        if (!existing) throw new NotFound();
        await tx.update(table).set(values).where(mine);
        if (existing.documentId !== data.documentId) replacedDocument = existing.documentId;
      } else {
        await tx.insert(table).values({ ...values, userId } as typeof pilotLicences.$inferInsert);
      }
    });
  } catch (e) {
    if (e instanceof NotFound) return { ok: false, error: "notFound" };
    if (pgCode(e) === "42501") return { ok: false, error: "documentInvalid" };
    throw e;
  }
  await deleteDocumentIfUnused(userId, replacedDocument);
  return { ok: true };
}

async function handleSave<S extends z.ZodType<{ id?: string; documentId: string | null }>>(
  kind: CredentialKind,
  schema: S,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser(PATH);
  const t = await getTranslations("pilot");
  const raw = formValues(formData);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };

  const { id, ...data } = parsed.data;
  const result = await saveCredential(user.id, kind, id, data);
  if (!result.ok) {
    if (result.error === "documentInvalid") {
      const v = await getTranslations("validation");
      return { errors: { documentId: [v("documentInvalid")] }, values: raw };
    }
    return { message: t("errors.notFound"), values: raw };
  }
  revalidatePath(PATH);
  revalidatePath("/dashboard");
  const savedKey = { licence: "licences.saved", rating: "ratings.saved", medical: "medical.saved" }[
    kind
  ] as "licences.saved";
  return { ok: true, message: t(savedKey) };
}

export async function saveLicence(_prev: FormState, formData: FormData) {
  return handleSave("licence", licenceSchema, formData);
}

export async function saveRating(_prev: FormState, formData: FormData) {
  return handleSave("rating", ratingSchema, formData);
}

export async function saveMedical(_prev: FormState, formData: FormData) {
  return handleSave("medical", medicalSchema, formData);
}

const deleteSchema = z.object({
  kind: z.enum(["licence", "rating", "medical"]),
  id: z.uuid(),
});

/** Delete a credential and its document (if nothing else uses it). */
export async function deleteCredential(formData: FormData) {
  const user = await requireUser(PATH);
  const { kind, id } = deleteSchema.parse(formValues(formData));
  const table = tables[kind] as typeof pilotLicences; // same columns used here
  const deleted = await asUser(user.id, (tx) =>
    tx
      .delete(table)
      .where(and(eq(table.id, id), eq(table.userId, user.id)))
      .returning({ documentId: table.documentId }),
  );
  for (const row of deleted) await deleteDocumentIfUnused(user.id, row.documentId);
  revalidatePath(PATH);
  revalidatePath("/dashboard");
}

export async function saveExperience(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser(PATH);
  const t = await getTranslations("pilot.experience");
  const raw = formValues(formData);
  const parsed = experienceSchema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };

  await asUser(user.id, (tx) =>
    tx
      .insert(pilotExperience)
      .values({ userId: user.id, ...parsed.data })
      .onConflictDoUpdate({ target: pilotExperience.userId, set: parsed.data }),
  );
  revalidatePath(PATH);
  return { ok: true, message: t("saved"), values: raw };
}

export async function saveTypeHours(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser(PATH);
  const raw = formValues(formData);
  const parsed = typeHoursSchema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };

  await asUser(user.id, (tx) =>
    tx
      .insert(experienceByType)
      .values({ userId: user.id, ...parsed.data })
      .onConflictDoUpdate({
        target: [experienceByType.userId, experienceByType.aircraftType],
        set: { hours: parsed.data.hours },
      }),
  );
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteTypeHours(formData: FormData) {
  const user = await requireUser(PATH);
  const aircraftType = z
    .string()
    .regex(/^[A-Z0-9]{2,6}$/)
    .parse(formData.get("aircraftType"));
  await asUser(user.id, (tx) =>
    tx
      .delete(experienceByType)
      .where(
        and(eq(experienceByType.userId, user.id), eq(experienceByType.aircraftType, aircraftType)),
      ),
  );
  revalidatePath(PATH);
}
