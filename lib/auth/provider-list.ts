// Plain data about the social log-ins (no secrets), usable anywhere incl. proxy.ts.

/** Social log-ins we support, in the order the buttons are shown. */
export const SOCIAL_PROVIDERS = ["google", "apple", "facebook"] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export const PROVIDER_NAMES: Record<SocialProvider, string> = {
  google: "Google",
  apple: "Apple",
  facebook: "Facebook",
};

/** Where each provider's sign-in page lives (the browser is redirected there: CSP form-action). */
export const PROVIDER_HOSTS: Record<SocialProvider, string> = {
  google: "https://accounts.google.com",
  apple: "https://appleid.apple.com",
  facebook: "https://www.facebook.com",
};

export function isSocialProvider(value: unknown): value is SocialProvider {
  return SOCIAL_PROVIDERS.includes(value as SocialProvider);
}
