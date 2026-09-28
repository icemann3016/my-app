import type { ReviewDirection } from "@/lib/db/schema";

/** Category scores per direction (RAT-2); must match public.review_categories() in SQL. */
export const REVIEW_CATEGORIES = {
  pilot_to_owner: ["aircraft_condition", "communication", "value"],
  owner_to_pilot: ["airmanship", "punctuality", "communication", "condition_returned"],
} as const satisfies Record<ReviewDirection, readonly string[]>;

export type ReviewCategory = (typeof REVIEW_CATEGORIES)[ReviewDirection][number];

/** Days after the owner confirms the flight log during which both sides can review (RAT-3). */
export const REVIEW_WINDOW_DAYS = 14;
