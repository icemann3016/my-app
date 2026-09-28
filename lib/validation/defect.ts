import { z } from "zod";

export const DEFECT_SEVERITIES = ["minor", "major", "unsafe"] as const;

const optionalUuid = (message = "invalid") =>
  z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((v) => v || null)
    .pipe(z.uuid(message).nullable());

/** A defect report (BKG-8). Messages are keys in messages/*.json → "validation". */
export const defectSchema = z.object({
  aircraftId: z.uuid(),
  bookingId: optionalUuid(),
  severity: z.enum(DEFECT_SEVERITIES),
  description: z.string().trim().min(1, "defectRequired").max(2000, "textTooLong"),
  photoId: optionalUuid("documentInvalid"),
});
