import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { getUser } from "@/lib/auth/session";
import { pgError } from "@/lib/db/errors";
import { asUser } from "@/lib/db/rls";
import { aircraftPhotos } from "@/lib/db/schema";
import { EXTENSIONS, sniffFileType } from "@/lib/files/sniff";
import { getStorage } from "@/lib/storage";
import { PHOTO_MAX_BYTES } from "@/lib/validation/aircraft";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Add a photo to an aircraft (multipart field "file"; JPG, PNG or WebP, checked by content).
 * Photos are public, like the listing. Only the aircraft's owner may add them (RLS).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/aircraft/[id]/photos">) {
  const t = await getTranslations("owner.photos");
  const { id } = await ctx.params;
  const user = await getUser();
  if (!user || !UUID.test(id)) return Response.json({ error: t("failed") }, { status: 404 });

  const lengthHeader = request.headers.get("content-length");
  if (!lengthHeader) return Response.json({ error: t("failed") }, { status: 411 });
  if (Number(lengthHeader) > PHOTO_MAX_BYTES + 64 * 1024) {
    return Response.json({ error: t("tooLarge") }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: t("failed") }, { status: 400 });
  if (file.size > PHOTO_MAX_BYTES) return Response.json({ error: t("tooLarge") }, { status: 413 });

  const body = new Uint8Array(await file.arrayBuffer());
  const type = sniffFileType(body);
  if (!type || type === "application/pdf") {
    return Response.json({ error: t("invalidType") }, { status: 400 });
  }

  const key = `aircraft/${id}/${randomUUID()}.${EXTENSIONS[type]}`;
  const storage = getStorage();
  await storage.put(key, body, type);
  try {
    await asUser(user.id, (tx) =>
      tx.insert(aircraftPhotos).values({ aircraftId: id, storageKey: key, sortOrder: 1000 }),
    );
  } catch (e) {
    await storage.delete(key).catch(() => undefined);
    const { code, hint } = pgError(e);
    if (hint === "too_many_photos") {
      return Response.json({ error: t("tooMany") }, { status: 400 });
    }
    if (code === "42501" || code === "23503") {
      return Response.json({ error: t("failed") }, { status: 404 });
    }
    console.error("[aircraft] photo upload failed", e);
    return Response.json({ error: t("failed") }, { status: 500 });
  }
  revalidatePath(`/owner/aircraft/${id}`, "layout");
  revalidatePath(`/aircraft/${id}`);
  return Response.json({ ok: true }, { status: 201 });
}
