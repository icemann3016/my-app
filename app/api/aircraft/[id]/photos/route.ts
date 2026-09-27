import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { savePhoto } from "@/lib/aircraft/photos";
import { isUuid } from "@/lib/aircraft/queries";
import { getUser } from "@/lib/auth/session";
import { PHOTO_MAX_BYTES } from "@/lib/validation/aircraft";

/** Upload one photo of the user's aircraft: multipart form field "file". */
export async function POST(request: Request, ctx: RouteContext<"/api/aircraft/[id]/photos">) {
  const t = await getTranslations("aircraft.photos");
  const { id } = await ctx.params;
  const user = await getUser();
  if (!user) return Response.json({ error: t("failed") }, { status: 401 });
  if (!isUuid(id)) return Response.json({ error: t("notFound") }, { status: 404 });

  // Refuse oversized (or unsized) bodies before reading them; the form adds a little overhead.
  const lengthHeader = request.headers.get("content-length");
  if (!lengthHeader) return Response.json({ error: t("failed") }, { status: 411 });
  if (Number(lengthHeader) > PHOTO_MAX_BYTES + 64 * 1024) {
    return Response.json({ error: t("tooLarge") }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: t("failed") }, { status: 400 });

  try {
    const result = await savePhoto(user.id, id, file);
    if (!result.ok) {
      const status = result.error === "notFound" ? 404 : 400;
      return Response.json({ error: t(result.error) }, { status });
    }
    revalidatePath(`/owner/aircraft/${id}`, "layout");
    revalidatePath(`/aircraft/${id}`);
    return Response.json(result, { status: 201 });
  } catch (e) {
    console.error("[aircraft] photo upload failed", e);
    return Response.json({ error: t("failed") }, { status: 500 });
  }
}
