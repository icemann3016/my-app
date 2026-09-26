import { z } from "zod";

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

export const newPasswordField = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.");

export const displayNameField = z
  .string()
  .trim()
  .min(1, "Enter your name.")
  .max(80, "Use at most 80 characters.");

export const signUpSchema = z.object({
  displayName: displayNameField,
  email: emailField,
  password: newPasswordField,
  terms: z.literal("on", { error: "Please accept the terms to continue." }),
});

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password."),
});

export const emailOnlySchema = z.object({ email: emailField });

const passwordsMatch = (d: { password: string; confirm: string }) => d.password === d.confirm;
const mismatch = { path: ["confirm"], error: "Passwords don't match." };

/** Choosing a new password from a reset link. */
export const resetPasswordSchema = z
  .object({ token: z.string().min(1), password: newPasswordField, confirm: z.string() })
  .refine(passwordsMatch, mismatch);

/** Changing the password while logged in. */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: newPasswordField,
    confirm: z.string(),
  })
  .refine(passwordsMatch, mismatch);
