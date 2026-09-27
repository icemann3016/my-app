import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { aircraft, aircraftPhotos } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";

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
