import { z } from "zod";

// Error messages are translation keys in messages/*.json → "validation" (see localizedFieldErrors).

export const emailField = z.string().trim().toLowerCase().pipe(z.email("emailInvalid"));

export const newPasswordField = z.string().min(8, "passwordMin").max(72, "passwordMax");

export const displayNameField = z.string().trim().min(1, "nameRequired").max(80, "nameMax");

export const signUpSchema = z.object({
  displayName: displayNameField,
  email: emailField,
  password: newPasswordField,
  terms: z.literal("on", { error: "termsRequired" }),
});

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "passwordRequired"),
});

export const emailOnlySchema = z.object({ email: emailField });

const passwordsMatch = (d: { password: string; confirm: string }) => d.password === d.confirm;
const mismatch = { path: ["confirm"], error: "passwordsMismatch" };

/** Choosing a new password from a reset link. */
export const resetPasswordSchema = z
  .object({ token: z.string().min(1), password: newPasswordField, confirm: z.string() })
  .refine(passwordsMatch, mismatch);

/** Changing the password while logged in. */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "currentPasswordRequired"),
    password: newPasswordField,
    confirm: z.string(),
  })
  .refine(passwordsMatch, mismatch);
