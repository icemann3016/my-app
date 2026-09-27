import { z } from "zod";

import {
  AIRCRAFT_CATEGORIES,
  CURRENCIES,
  DOCUMENT_KINDS,
  FILE_KINDS,
  FUEL_TYPES,
  normaliseRegistration,
  OIL_UNITS,
  PRICE_BASES,
  TIME_BASES,
  TRANSPONDERS,
  UNRATED_POLICIES,
} from "@/lib/aircraft/catalog";
import { LICENCE_TYPES } from "@/lib/pilot/catalog";

// Messages are translation keys in messages/*.json → "validation". Empty optional fields become
// null so a draft can be saved half-filled.

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "tooLong")
    .transform((v) => v || null);

/** Optional number; `min`/`max` inclusive. */
const num = (min: number, max: number, opts: { int?: boolean } = {}) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v.replace(",", "."))))
    .refine(
      (v) =>
        v === null ||
        (Number.isFinite(v) && v >= min && v <= max && (!opts.int || Number.isInteger(v))),
      "numberInvalid",
    );

const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

export const registrationSchema = z
  .string()
  .transform(normaliseRegistration)
  .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9-]{1,8}[A-Z0-9]$/, "registrationInvalid"));

export const detailsSchema = z.object({
  registration: registrationSchema,
  manufacturer: text(60),
  model: text(60),
  icaoType: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[A-Z0-9]{2,4}$/.test(v), "icaoTypeInvalid")
    .transform((v) => v || null),
  year: num(1903, 2100, { int: true }),
  category: z.enum(AIRCRAFT_CATEGORIES, "invalid"),
  seats: num(1, 20, { int: true }),
  engine: text(100),
  fuelType: z.enum(["", ...FUEL_TYPES], "invalid").transform((v) => (v === "" ? null : v)),
  /** In the user's volume unit per hour; converted to L/h by the action. */
  fuelBurn: num(0, 2000),
  cruiseKt: num(0, 500, { int: true }),
  /** In the user's mass unit; converted to kg by the action. */
  usefulLoad: num(0, 20000),
  enduranceH: num(0, 24),
  oilUnit: z.enum(OIL_UNITS, "invalid"),
});

export const equipmentSchema = z.object({
  avionics: text(200),
  autopilot: checkbox,
  transponder: z.enum(TRANSPONDERS, "invalid"),
  adsbOut: checkbox,
  nightVfr: checkbox,
  ifr: checkbox,
  equipmentNotes: text(1000),
  description: text(4000),
});

export const baseSchema = z.object({
  homeAirportIdent: z
    .string()
    .trim()
    .transform((v) => v || null),
});

export const pricingSchema = z.object({
  pricePerHour: num(0, 100000),
  weekendPricePerHour: num(0, 100000),
  currency: z.enum(CURRENCIES, "invalid"),
  priceBasis: z.enum(PRICE_BASES, "invalid"),
  timeBasis: z.enum(TIME_BASES, "invalid"),
  minHoursPerDay: num(0, 24),
  freeCancellationHours: num(0, 720, { int: true }).transform((v) => v ?? 24),
  cancellationNote: text(500),
});

export const aircraftDocumentSchema = z
  .object({
    id: z
      .string()
      .trim()
      .transform((v) => v || undefined)
      .pipe(z.uuid().optional()),
    kind: z.enum(DOCUMENT_KINDS, "invalid"),
    expiresOn: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "dateInvalid")
      .transform((v) => v || null),
    documentId: z.string().trim().min(1, "documentRequired").pipe(z.uuid("documentInvalid")),
  })
  .refine((d) => d.kind === "cofa" || d.expiresOn, {
    path: ["expiresOn"],
    error: "expiryRequired",
  });

export const aircraftFileSchema = z.object({
  kind: z.enum(FILE_KINDS, "invalid"),
  title: text(100),
  documentId: z.string().trim().min(1, "documentRequired").pipe(z.uuid("documentInvalid")),
});

/** Checkbox groups arrive as repeated fields: read them with formData.getAll(). */
export const requirementsSchema = z.object({
  minPilotRating: num(1, 5),
  minReviews: num(1, 50, { int: true }).transform((v) => v ?? 1),
  unratedPolicy: z.enum(UNRATED_POLICIES, "invalid"),
  licenceTypes: z.array(z.enum(LICENCE_TYPES, "invalid")).max(10),
  requiredRatings: z
    .array(
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9_]{2,20}$/, "ratingCodeInvalid"),
    )
    .max(10),
  minTotalHours: num(0, 99999),
  minTypeHours: num(0, 99999),
  min90DayHours: num(0, 2000),
  minAge: num(16, 99, { int: true }),
});

export const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PHOTOS = 20;
