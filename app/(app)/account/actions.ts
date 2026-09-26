"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { fieldErrors, formValues, type FormState, withoutSecrets } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { updatePasswordSchema } from "@/lib/validation/auth";
import { profileSchema, selfServiceRoleSchema } from "@/lib/validation/profile";

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/account");
  const raw = formValues(formData);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      home_airport_icao: parsed.data.homeAirport,
      bio: parsed.data.bio,
    })
    .eq("id", user.id);
  if (error) return { message: "Couldn't save your profile. Please try again.", values: raw };

  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved.", values: raw };
}

/**
 * Save (or clear) the avatar after the browser uploaded the file to storage.
 * Deletes the previous file so old photos don't pile up.
 */
export async function setAvatar(path: string | null): Promise<{ error?: string }> {
  const user = await requireUser("/account");
  if (path !== null && !path.startsWith(`${user.id}/`)) return { error: "Invalid file." };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .single();

  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (error) return { error: "Couldn't save your photo. Please try again." };

  const old = current?.avatar_path;
  if (old && old !== path && old.startsWith(`${user.id}/`)) {
    await supabase.storage.from("avatars").remove([old]);
  }
  revalidatePath("/", "layout");
  return {};
}

export async function setRole(formData: FormData) {
  const user = await requireUser("/account");
  const role = selfServiceRoleSchema.parse(formData.get("role"));
  const enable = formData.get("enable") === "true";

  const supabase = await createClient();
  if (enable) {
    await supabase
      .from("user_roles")
      .upsert({ user_id: user.id, role }, { onConflict: "user_id,role", ignoreDuplicates: true });
  } else {
    await supabase.from("user_roles").delete().eq("user_id", user.id).eq("role", role);
  }
  revalidatePath("/", "layout");
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("/account/password");
  const raw = formValues(formData);
  const parsed = updatePasswordSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: withoutSecrets(raw) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const message =
      error.code === "same_password"
        ? "Your new password must be different from the old one."
        : error.code === "weak_password"
          ? "Please choose a stronger password."
          : "Couldn't change your password. Please try again.";
    return { message };
  }
  return { ok: true, message: "Password changed." };
}
