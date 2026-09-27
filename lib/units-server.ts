import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";

import { getUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db/rls";
import { userSettings } from "@/lib/db/schema";
import { isUnits, type Units } from "@/lib/units";

/** The viewer's units (Account → Preferences). Visitors get metric, the European default. */
export const getUserUnits = cache(async (): Promise<Units> => {
  const user = await getUser();
  if (!user) return "metric";
  const [row] = await asUser(user.id, (tx) =>
    tx
      .select({ units: userSettings.units })
      .from(userSettings)
      .where(eq(userSettings.userId, user.id)),
  );
  return isUnits(row?.units) ? row.units : "metric";
});
