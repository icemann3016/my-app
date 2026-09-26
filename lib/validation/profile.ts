import { z } from "zod";

import { locales } from "@/lib/i18n/config";
import { displayNameField } from "./auth";

export const profileSchema = z.object({
  displayName: displayNameField,
  homeAirport: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[A-Z0-9]{4}$/.test(v), "icaoInvalid")
    .transform((v) => v || null),
  bio: z
    .string()
    .trim()
    .max(1000, "bioMax")
    .transform((v) => v || null),
});

export const selfServiceRoleSchema = z.enum(["pilot", "owner"]);

export const preferencesSchema = z.object({
  locale: z.enum(locales),
  units: z.enum(["metric", "imperial"]),
});

export const deleteAccountSchema = z.object({
  password: z.string().optional(),
  confirm: z.string().trim(),
});

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
