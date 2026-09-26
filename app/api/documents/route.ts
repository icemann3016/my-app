import { getTranslations } from "next-intl/server";

import { getUser } from "@/lib/auth/session";
import { saveDocument } from "@/lib/documents";
import { DOCUMENT_MAX_BYTES } from "@/lib/validation/pilot";

/**
 * Upload a private document (licence, medical…): multipart form field "file".
 * Returns its id, which the credential form then saves. Unattached uploads are removed by the
 * daily job after a day.
 */
export async function POST(request: Request) {
  const t = await getTranslations("documents");
  const user = await getUser();
  if (!user) return Response.json({ error: t("failed") }, { status: 401 });

  // Refuse oversized (or unsized) bodies before reading them; the form adds a little overhead.
  const lengthHeader = request.headers.get("content-length");
  if (!lengthHeader) return Response.json({ error: t("failed") }, { status: 411 });
  if (Number(lengthHeader) > DOCUMENT_MAX_BYTES + 64 * 1024) {
    return Response.json({ error: t("tooLarge") }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: t("failed") }, { status: 400 });

  try {
    const result = await saveDocument(user.id, file);
    if (!result.ok) return Response.json({ error: t(result.error) }, { status: 400 });
    return Response.json(result, { status: 201 });
  } catch (e) {
    console.error("[documents] upload failed", e);
    return Response.json({ error: t("failed") }, { status: 500 });
  }
}
