import { z } from "zod";

import { FUEL_TYPES } from "@/lib/aircraft/catalog";
import { oilToLitres, type UnitSystem, volumeToLitres } from "@/lib/domain/units";

// Messages are translation keys in messages/*.json → "validation".

/** "" → null; "1234,5" → 1234.5; must be within the range. */
const reading = (max: number, message = "numberInvalid") =>
  z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((v) => (v === "" ? null : Number(v.replace(",", "."))))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= max), message);

const clock = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "timeInvalid");
const optionalClock = z
  .string()
  .trim()
  .optional()
  .default("")
  .refine((v) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "timeInvalid");

/** Check-out readings (BKG-7): meters, fuel (user's units) and oil (dipstick unit) on board. */
export function checkoutSchema(units: UnitSystem, oilUnit: "qt" | "l") {
  return z
    .object({
      logId: z.uuid(),
      hobbsStart: reading(999999),
      tachStart: reading(999999),
      fuelStart: reading(5000),
      oilStart: reading(100),
      checkoutPhotoId: z
        .string()
        .trim()
        .optional()
        .default("")
        .transform((v) => v || null)
        .pipe(z.uuid("documentInvalid").nullable()),
    })
    .transform(({ fuelStart, oilStart, ...d }) => ({
      ...d,
      fuelStartL: fuelStart === null ? null : volumeToLitres(fuelStart, units),
      oilStartL: oilStart === null ? null : oilToLitres(oilStart, oilUnit),
    }));
}

/** One leg (BKG-12…14). Times are local clock times; the server turns them into UTC. */
export function legSchema(units: UnitSystem, oilUnit: "qt" | "l") {
  return z
    .object({
      logId: z.uuid(),
      legId: z
        .string()
        .trim()
        .optional()
        .transform((v) => v || undefined)
        .pipe(z.uuid().optional()),
      from: z.string().trim().min(1, "airportUnknown").max(10),
      to: z.string().trim().min(1, "airportUnknown").max(10),
      date: z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "dateInvalid"),
      blockOff: clock,
      engineStart: clock,
      takeoff: optionalClock,
      landing: optionalClock,
      engineStop: clock,
      blockOn: clock,
      landings: z.coerce
        .number("numberInvalid")
        .int("numberInvalid")
        .min(1, "numberInvalid")
        .max(99),
      hobbsStart: reading(999999),
      hobbsEnd: reading(999999),
      tachStart: reading(999999),
      tachEnd: reading(999999),
      fuelBefore: reading(5000),
      fuelAfter: reading(5000),
      oilBefore: reading(100),
      oilAfter: reading(100),
    })
    .refine((d) => d.hobbsEnd === null || d.hobbsStart === null || d.hobbsEnd >= d.hobbsStart, {
      path: ["hobbsEnd"],
      error: "meterBackwards",
    })
    .refine((d) => d.tachEnd === null || d.tachStart === null || d.tachEnd >= d.tachStart, {
      path: ["tachEnd"],
      error: "meterBackwards",
    })
    .transform(({ fuelBefore, fuelAfter, oilBefore, oilAfter, ...d }) => ({
      ...d,
      fuelBeforeL: fuelBefore === null ? null : volumeToLitres(fuelBefore, units),
      fuelAfterL: fuelAfter === null ? null : volumeToLitres(fuelAfter, units),
      oilBeforeL: oilBefore === null ? null : oilToLitres(oilBefore, oilUnit),
      oilAfterL: oilAfter === null ? null : oilToLitres(oilAfter, oilUnit),
    }));
}

export type LegInput = z.infer<ReturnType<typeof legSchema>>;

/** Fuel or oil added (BKG-13, BKG-14): fuel in the user's units, oil in the dipstick unit. */
export function upliftSchema(units: UnitSystem, oilUnit: "qt" | "l") {
  return z
    .object({
      logId: z.uuid(),
      upliftId: z
        .string()
        .trim()
        .optional()
        .transform((v) => v || undefined)
        .pipe(z.uuid().optional()),
      kind: z.enum(["fuel", "oil"]),
      airport: z.string().trim().min(1, "airportUnknown").max(10),
      quantity: reading(5000).refine((v) => v !== null && v > 0, "numberInvalid"),
      fuelType: z.enum(FUEL_TYPES).optional().catch(undefined),
      oilGrade: z.string().trim().max(40).optional().default(""),
      price: reading(100000),
      paidBy: z.enum(["pilot", "owner"]),
      receiptId: z
        .string()
        .trim()
        .optional()
        .default("")
        .transform((v) => v || null)
        .pipe(z.uuid("documentInvalid").nullable()),
    })
    .transform(({ quantity, kind, fuelType, oilGrade, ...d }) => ({
      ...d,
      kind,
      quantityL:
        kind === "fuel" ? volumeToLitres(quantity!, units) : oilToLitres(quantity!, oilUnit),
      fuelType: kind === "fuel" ? (fuelType ?? null) : null,
      oilGrade: kind === "oil" && oilGrade ? oilGrade : null,
    }));
}

export const REMARK_KINDS = ["aircraft", "weather", "airfield"] as const;

/** A remark or PIREP after a flight (BKG-15). */
export const remarkSchema = z.object({
  logId: z.uuid(),
  kind: z.enum(REMARK_KINDS),
  airport: z.string().trim().max(10).optional().default(""),
  body: z.string().trim().min(1, "remarkRequired").max(1000, "textTooLong"),
});
