/** Notification channels a user can switch (MSG-3); columns of user_settings. */
export const NOTIFICATION_SETTINGS = [
  "emailBookings",
  "inAppBookings",
  "emailReviews",
  "inAppReviews",
  "emailMessages",
] as const;
export type NotificationSetting = (typeof NOTIFICATION_SETTINGS)[number];
export type NotificationSettings = Record<NotificationSetting, boolean>;
