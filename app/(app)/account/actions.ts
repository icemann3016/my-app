"use server";

import { APIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getAuth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db/rls";
import { profiles, userRoles } from "@/lib/db/schema";
import { fieldErrors, formValues, type FormState, withoutSecrets } from "@/lib/forms";
import { changePasswordSchema } from "@/lib/validation/auth";
import { profileSchema, selfServiceRoleSchema } from "@/lib/validation/profile";

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/account");
  const raw = formValues(formData);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  try {
    await asUser(user.id, (tx) =>
      tx
        .update(profiles)
        .set({
          displayName: parsed.data.displayName,
          homeAirportIcao: parsed.data.homeAirport,
          bio: parsed.data.bio,
        })
        .where(eq(profiles.id, user.id)),
    );
  } catch (error) {
    console.error("[account] profile update failed", error);
    return { message: "Couldn't save your profile. Please try again.", values: raw };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved.", values: raw };
}

export async function setRole(formData: FormData) {
  const user = await requireUser("/account");
  const role = selfServiceRoleSchema.parse(formData.get("role"));
  const enable = formData.get("enable") === "true";

  await asUser(user.id, async (tx) => {
    if (enable) {
      await tx.insert(userRoles).values({ userId: user.id, role }).onConflictDoNothing();
    } else {
      await tx
        .delete(userRoles)
        .where(and(eq(userRoles.userId, user.id), eq(userRoles.role, role)));
    }
  });
  revalidatePath("/", "layout");
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("/account/password");
  const raw = formValues(formData);
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: withoutSecrets(raw) };

  try {
    await getAuth().api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.password,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } catch (error) {
    const code = error instanceof APIError ? error.body?.code : undefined;
    if (code === "INVALID_PASSWORD") {
      return { errors: { currentPassword: ["Your current password is not correct."] } };
    }
    console.error("[account] password change failed", error);
    return { message: "Couldn't change your password. Please try again." };
  }
  return { ok: true, message: "Password changed. You've been logged out on other devices." };
}
