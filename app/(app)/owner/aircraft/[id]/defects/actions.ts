"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db/rls";
import { aircraft } from "@/lib/db/schema";

/** The owner marks a defect as fixed, with an optional note (BKG-8). */
export async function resolveDefect(formData: FormData) {
  const user = await requireUser("/owner/aircraft");
  const defectId = z.uuid().parse(formData.get("defectId"));
  const aircraftId = z.uuid().parse(formData.get("aircraftId"));
  const note = String(formData.get("note") ?? "");
  await asUser(user.id, (tx) =>
    tx.execute(sql`select public.resolve_defect(${defectId}::uuid, ${note})`),
  );
  revalidatePath(`/owner/aircraft/${aircraftId}`, "layout");
}

/** Ground the aircraft: no bookings, acceptances or check-outs until it's listed again. */
export async function groundAircraft(formData: FormData) {
  const user = await requireUser("/owner/aircraft");
  const aircraftId = z.uuid().parse(formData.get("aircraftId"));
  await asUser(user.id, (tx) =>
    tx
      .update(aircraft)
      .set({ status: "grounded" })
      .where(
        and(
          eq(aircraft.id, aircraftId),
          eq(aircraft.ownerId, user.id),
          inArray(aircraft.status, ["listed", "paused", "unlisted"]),
        ),
      ),
  );
  revalidatePath("/owner/aircraft", "layout");
  revalidatePath("/bookings", "layout");
}
