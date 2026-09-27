import { z } from "zod";

export const BOOKING_PURPOSES = ["local", "cross_country", "training", "other"] as const;
export const MAX_STOPS = 3;

const localDateTime = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "dateTimeInvalid");
const airfield = z.string().trim().min(1, "airportUnknown").max(10, "airportUnknown");

/** A booking request (BKG-1). Times are local to the departure airfield. */
export const bookingRequestSchema = z
  .object({
    aircraftId: z.uuid(),
    from: localDateTime,
    to: localDateTime,
    departure: airfield,
    arrival: airfield,
    stops: z.array(z.string().trim().max(10)).max(MAX_STOPS).default([]),
    purpose: z.enum(BOOKING_PURPOSES, "invalid"),
    passengers: z.coerce.number("numberInvalid").int("numberInvalid").min(0).max(19),
    plannedHours: z
      .string()
      .trim()
      .transform((v) => Number(v.replace(",", ".")))
      .refine((v) => Number.isFinite(v) && v >= 0.1 && v <= 99, "plannedHoursInvalid"),
    message: z.string().trim().max(1000, "textTooLong").optional().default(""),
  })
  .refine((d) => d.to > d.from, { path: ["to"], error: "endBeforeStart" })
  .transform((d) => ({
    ...d,
    stops: d.stops.filter(Boolean),
    plannedHours: Math.round(d.plannedHours * 10) / 10,
  }));

export type BookingRequestInput = z.infer<typeof bookingRequestSchema>;

/** The owner's answer (BKG-3). A suggested time is local to the departure airfield. */
export const bookingResponseSchema = z
  .object({
    bookingId: z.uuid(),
    decision: z.enum(["accept", "decline", "propose"]),
    note: z.string().trim().max(500, "textTooLong").optional().default(""),
    proposeFrom: localDateTime.optional().or(z.literal("")),
    proposeTo: localDateTime.optional().or(z.literal("")),
  })
  .refine((d) => d.decision !== "propose" || (d.proposeFrom && d.proposeTo), {
    path: ["proposeFrom"],
    error: "dateTimeInvalid",
  })
  .refine((d) => d.decision !== "propose" || (d.proposeTo ?? "") > (d.proposeFrom ?? ""), {
    path: ["proposeTo"],
    error: "endBeforeStart",
  });
