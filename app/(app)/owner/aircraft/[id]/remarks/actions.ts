"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db/rls";

/** The aircraft's owner marks an aircraft remark as a known item, or as fixed. */
export async function setKnownItem(formData: FormData) {
  const user = await requireUser("/owner/aircraft");
  const remarkId = z.uuid().parse(formData.get("remarkId"));
  const state = z.enum(["known", "resolved"]).parse(formData.get("state"));
  await asUser(user.id, (tx) =>
    tx.execute(sql`select public.set_known_item(${remarkId}::uuid, ${state})`),
  );
  revalidatePath("/owner/aircraft", "layout");
  revalidatePath("/bookings", "layout");
}
