/** Moderation actions an admin can take (ADM-2, ADM-3); see app/(app)/admin/moderation-actions. */
export const MODERATION_OPS = [
  "suspend",
  "unsuspend",
  "unlist",
  "allow_listing",
  "hide_review",
  "show_review",
  "resolve_report",
  "dismiss_report",
] as const;
export type ModerationOp = (typeof MODERATION_OPS)[number];
