import "server-only";

import { sql } from "drizzle-orm";

import { asUser } from "@/lib/db/rls";
import { toRange } from "@/lib/domain/time";

export type RespondOutcome = { ok: true; status: string } | { ok: false; error: string };

/** The owner accepts or declines a request, optionally suggesting another time (BKG-3). */
export async function respondToBooking(
  ownerId: string,
  bookingId: string,
  decision: "accept" | "decline",
  note: string | null,
  proposal: { from: Date; to: Date } | null,
): Promise<RespondOutcome> {
  try {
    const rows = (await asUser(ownerId, (tx) =>
      tx.execute(sql`select public.respond_to_booking(${bookingId}::uuid, ${decision}, ${note},
        ${proposal ? toRange(proposal.from, proposal.to) : null}::tstzrange) as status`),
    )) as unknown as { status: string }[];
    return { ok: true, status: rows[0]!.status };
  } catch (e) {
    const err = e as { cause?: { code?: string; message?: string } };
    if (err.cause?.code === "P0001" && err.cause.message)
      return { ok: false, error: err.cause.message };
    throw e;
  }
}
