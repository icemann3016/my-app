import "server-only";

import { eq } from "drizzle-orm";

import { deleteAllAircraftPhotoFiles } from "@/lib/aircraft/photos";
import { getDb, schema } from "@/lib/db";
import { deleteAllDocumentFiles } from "@/lib/documents";
import { getStorage } from "@/lib/storage";

/**
 * Remove a user's files from storage before their account is deleted: an uploaded avatar,
 * licence, medical and aircraft documents, and aircraft photos. The database rows go with the
 * user (ON DELETE CASCADE / SET NULL). Used when members delete themselves and by admins.
 */
export async function deleteUserFiles(userId: string): Promise<void> {
  const [profile] = await getDb()
    .select({ avatarKey: schema.profiles.avatarKey })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, userId));
  // Only uploaded photos are files of the user's own (ready-made avatars are shared).
  if (profile?.avatarKey?.startsWith(`avatars/${userId}/`)) {
    await getStorage()
      .delete(profile.avatarKey)
      .catch((e) => console.warn("[account] couldn't delete avatar", e));
  }
  await deleteAllDocumentFiles(userId);
  await deleteAllAircraftPhotoFiles(userId);
}
