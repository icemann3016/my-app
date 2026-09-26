import { z } from "zod";

import { displayNameField } from "./auth";

export const profileSchema = z.object({
  displayName: displayNameField,
  homeAirport: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[A-Z0-9]{4}$/.test(v), "Use a 4-character ICAO code, e.g. LBSF.")
    .transform((v) => v || null),
  bio: z
    .string()
    .trim()
    .max(1000, "Use at most 1000 characters.")
    .transform((v) => v || null),
});

export const selfServiceRoleSchema = z.enum(["pilot", "owner"]);

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
