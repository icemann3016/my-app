import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { asUser } from "@/lib/db/rls";
import { aircraft, aircraftPhotos } from "@/lib/db/schema";
import { EXTENSIONS, sniffFileType } from "@/lib/files/sniff";
import { getStorage } from "@/lib/storage";
import { PHOTO_MAX_BYTES } from "@/lib/validation/aircraft";
import { MAX_PHOTOS } from "./catalog";

export type PhotoUploadError = "invalidType" | "tooLarge" | "tooMany" | "notFound";
export type PhotoUploadResult = { ok: true; id: string } | { ok: false; error: PhotoUploadError };

/** Add a photo (JPEG, PNG or WebP, checked by content) to the user's aircraft, as the last one. */
export async function savePhoto(
  userId: string,
  aircraftId: string,
  file: File,
): Promise<PhotoUploadResult> {
  if (file.size > PHOTO_MAX_BYTES) return { ok: false, error: "tooLarge" };
  const body = new Uint8Array(await file.arrayBuffer());
  const type = sniffFileType(body);
  if (!type || type === "application/pdf") return { ok: false, error: "invalidType" };

  const count = await asUser(userId, async (tx) => {
    const [own] = await tx
      .select({ id: aircraft.id })
      .from(aircraft)
      .where(and(eq(aircraft.id, aircraftId), eq(aircraft.ownerId, userId)));
    if (!own) return null;
    const [row] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(aircraftPhotos)
      .where(eq(aircraftPhotos.aircraftId, aircraftId));
    return row?.n ?? 0;
  });
  if (count === null) return { ok: false, error: "notFound" };
  if (count >= MAX_PHOTOS) return { ok: false, error: "tooMany" };

  const key = `aircraft/${aircraftId}/${randomUUID()}.${EXTENSIONS[type]}`;
  await getStorage().put(key, body, type);
  try {
    const [row] = await asUser(userId, (tx) =>
      tx
        .insert(aircraftPhotos)
        .values({
          aircraftId,
          storageKey: key,
          sortOrder: sql`coalesce((select max(${aircraftPhotos.sortOrder}) + 1 from ${aircraftPhotos}
            where ${aircraftPhotos.aircraftId} = ${aircraftId}), 0)`,
        })
        .returning({ id: aircraftPhotos.id }),
    );
    return { ok: true, id: row!.id };
  } catch (e) {
    await getStorage()
      .delete(key)
      .catch(() => undefined);
    // The database allows at most 20 photos (two uploads at the same moment).
    const code = (e as { cause?: { code?: string } }).cause?.code;
    if (code === "23514") return { ok: false, error: "tooMany" };
    throw e;
  }
}

/** Remove photo files from public storage (their rows are deleted separately or by cascade). */
export async function deletePhotoFiles(storageKeys: string[]) {
  for (const key of storageKeys) {
    await getStorage()
      .delete(key)
      .catch((e) => console.warn("[aircraft] couldn't delete photo", e));
  }
}

/** Photo files of all of a user's aircraft (used when the account is deleted). */
export async function deleteAllAircraftPhotoFiles(userId: string) {
  const rows = await getDb()
    .select({ storageKey: aircraftPhotos.storageKey })
    .from(aircraftPhotos)
    .innerJoin(aircraft, eq(aircraft.id, aircraftPhotos.aircraftId))
    .where(eq(aircraft.ownerId, userId));
  await deletePhotoFiles(rows.map((r) => r.storageKey));
}
