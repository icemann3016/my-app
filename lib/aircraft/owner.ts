import "server-only";

import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getOwnAircraft } from "./queries";

/** For owner pages: the logged-in user's aircraft with this id, or a 404. */
export async function requireOwnAircraft(id: string, section = "") {
  const user = await requireUser(`/owner/aircraft/${id}${section ? `/${section}` : ""}`);
  const aircraft = await getOwnAircraft(user.id, id);
  if (!aircraft) notFound();
  return { user, aircraft };
}
