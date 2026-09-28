import { z } from "zod";

/** The owner records a pilot's checkout flight on the aircraft (BKG-10). */
export const checkoutRecordSchema = z.object({
  bookingId: z.uuid(),
  doneOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateInvalid"),
  instructor: z
    .string()
    .trim()
    .max(100, "textTooLong")
    .transform((v) => v || null),
  note: z
    .string()
    .trim()
    .max(500, "textTooLong")
    .transform((v) => v || null),
});
