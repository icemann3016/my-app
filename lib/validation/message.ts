import { z } from "zod";

const body = z.string().trim().min(1, "messageRequired").max(4000, "textTooLong");

/** A message in a conversation (MSG-1). Messages are "validation" keys. */
export const messageSchema = z.object({ conversationId: z.uuid(), body });

/** The first message about a listing. */
export const enquirySchema = z.object({ aircraftId: z.uuid(), body });
