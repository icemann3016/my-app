import { z } from "zod";

import { CATEGORIES, PRICE_BASES } from "@/lib/aircraft/catalog";

export const RADII_KM = [25, 50, 100, 200, 500] as const;
export const SORTS = ["distance", "price", "rating", "newest"] as const;

/** Anything invalid in the URL is simply ignored (search links get shared and edited). */
const lenient = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);
const flag = z
  .string()
  .optional()
  .transform((v) => v === "1" || v === "on" || v === "true")
  .catch(false);
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

/** Search filters from the URL (SRC-1, SRC-2). */
export const searchSchema = z.object({
  airport: lenient(z.string().trim().min(2).max(10)),
  radius: z.coerce
    .number()
    .refine((r) => (RADII_KM as readonly number[]).includes(r))
    .catch(100)
    .default(100),
  from: lenient(localDateTime),
  to: lenient(localDateTime),
  category: lenient(z.enum(CATEGORIES)),
  seats: lenient(z.coerce.number().int().min(1).max(20)),
  maxPrice: lenient(z.coerce.number().positive().max(99999)),
  fuel: lenient(z.enum(PRICE_BASES)),
  night: flag,
  ifr: flag,
  avionics: lenient(z.string().trim().min(1).max(40)),
  eligible: flag,
  sort: z.enum(SORTS).catch("distance").default("distance"),
});

export type SearchFilters = z.infer<typeof searchSchema>;

/** Read filters from Next.js searchParams (arrays keep their first value). */
export function parseSearch(params: Record<string, string | string[] | undefined>): SearchFilters {
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  return searchSchema.parse(Object.fromEntries(Object.entries(flat).filter(([, v]) => v !== "")));
}
