import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db/rls";
import { profiles } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from "@/lib/validation/profile";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function error(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/** Replace the avatar with the old file cleaned up afterwards. */
async function saveAvatarKey(userId: string, key: string | null) {
  const previous = await asUser(userId, async (tx) => {
    const [row] = await tx
      .select({ avatarKey: profiles.avatarKey })
      .from(profiles)
      .where(eq(profiles.id, userId));
    await tx.update(profiles).set({ avatarKey: key }).where(eq(profiles.id, userId));
    return row?.avatarKey ?? null;
  });
  if (previous && previous !== key && previous.startsWith(`avatars/${userId}/`)) {
    await getStorage()
      .delete(previous)
      .catch((e) => console.warn("[avatar] couldn't delete old file", e));
  }
  revalidatePath("/", "layout");
}

/** Upload a new profile photo (multipart form field "file"). */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return error("Please log in again.", 401);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return error("No file received.");
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
    return error("Please choose a JPG, PNG or WebP image.");
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return error("That image is larger than 2 MB. Please choose a smaller one.");
  }

  const key = `avatars/${user.id}/${Date.now()}.${EXTENSIONS[file.type]}`;
  try {
    await getStorage().put(key, new Uint8Array(await file.arrayBuffer()), file.type);
    await saveAvatarKey(user.id, key);
  } catch (e) {
    console.error("[avatar] upload failed", e);
    return error("Upload failed. Please try again.", 500);
  }
  return Response.json({ ok: true });
}

/** Remove the profile photo. */
export async function DELETE() {
  const user = await getUser();
  if (!user) return error("Please log in again.", 401);
  await saveAvatarKey(user.id, null);
  return Response.json({ ok: true });
}
