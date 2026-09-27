"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { deletePhotoFiles } from "@/lib/aircraft/photos";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db/rls";
import { aircraft, aircraftPhotos } from "@/lib/db/schema";

function refresh(aircraftId: string) {
  revalidatePath(`/owner/aircraft/${aircraftId}`, "layout");
  revalidatePath(`/aircraft/${aircraftId}`);
  revalidatePath("/owner/aircraft");
}

const orderSchema = z.object({
  aircraftId: z.uuid(),
  order: z.array(z.uuid()).min(1).max(20),
});

/** Save the photos' order (the first one is the cover). RLS limits it to the owner's photos. */
export async function reorderPhotos(aircraftId: string, order: string[]) {
  const user = await requireUser();
  const parsed = orderSchema.parse({ aircraftId, order });
  await asUser(user.id, async (tx) => {
    const cases = sql.join(
      parsed.order.map((id, i) => sql`when ${id}::uuid then ${i}::int`),
      sql` `,
    );
    await tx
      .update(aircraftPhotos)
      .set({ sortOrder: sql`case ${aircraftPhotos.id} ${cases} end` })
      .where(
        and(
          eq(aircraftPhotos.aircraftId, parsed.aircraftId),
          inArray(aircraftPhotos.id, parsed.order),
        ),
      );
  });
  refresh(parsed.aircraftId);
}

const deleteSchema = z.object({ aircraftId: z.uuid(), photoId: z.uuid() });

/**
 * Delete one photo of the user's aircraft (row and file). A listed aircraft keeps at least one
 * photo (LST-3).
 */
export async function deletePhoto(
  aircraftId: string,
  photoId: string,
): Promise<{ ok: boolean; error?: "lastPhoto" }> {
  const user = await requireUser();
  const parsed = deleteSchema.parse({ aircraftId, photoId });
  const deleted = await asUser(user.id, async (tx) => {
    const [own] = await tx
      .select({ status: aircraft.status })
      .from(aircraft)
      .where(and(eq(aircraft.id, parsed.aircraftId), eq(aircraft.ownerId, user.id)));
    if (!own) return [];
    if (own.status === "listed") {
      const [row] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(aircraftPhotos)
        .where(eq(aircraftPhotos.aircraftId, parsed.aircraftId));
      if ((row?.n ?? 0) <= 1) return null;
    }
    return tx
      .delete(aircraftPhotos)
      .where(
        and(
          eq(aircraftPhotos.id, parsed.photoId),
          eq(aircraftPhotos.aircraftId, parsed.aircraftId),
        ),
      )
      .returning({ storageKey: aircraftPhotos.storageKey });
  });
  if (deleted === null) return { ok: false, error: "lastPhoto" };
  await deletePhotoFiles(deleted.map((d) => d.storageKey));
  refresh(parsed.aircraftId);
  return { ok: true };
}
