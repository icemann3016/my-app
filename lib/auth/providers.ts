import "server-only";

import { createPrivateKey } from "node:crypto";

import { appleClientSecret, normalizePrivateKey } from "./apple-secret";
import { SOCIAL_PROVIDERS, type SocialProvider } from "./provider-list";

export * from "./provider-list";

const env = (name: string) => process.env[name]?.trim() || undefined;

/** A provider's button is shown only when its keys are configured. */
export function isProviderEnabled(provider: SocialProvider): boolean {
  switch (provider) {
    case "google":
      return Boolean(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));
    case "apple":
      return Boolean(
        env("APPLE_CLIENT_ID") &&
        env("APPLE_TEAM_ID") &&
        env("APPLE_KEY_ID") &&
        appleKeyReadable(env("APPLE_PRIVATE_KEY")),
      );
    case "facebook":
      return Boolean(env("FACEBOOK_CLIENT_ID") && env("FACEBOOK_CLIENT_SECRET"));
  }
}

/** A mistyped key would show a button that can't work: treat it as not configured. */
function appleKeyReadable(key: string | undefined): boolean {
  if (!key) return false;
  try {
    createPrivateKey(normalizePrivateKey(key));
    return true;
  } catch {
    console.error("[auth] APPLE_PRIVATE_KEY can't be read; Apple sign-in is off");
    return false;
  }
}

export function enabledProviders(): SocialProvider[] {
  return SOCIAL_PROVIDERS.filter(isProviderEnabled);
}

/** Better Auth's `socialProviders` option for the configured providers. */
export function socialProviderOptions() {
  const options: {
    google?: { clientId: string; clientSecret: string };
    apple?: { clientId: string; clientSecret: string };
    facebook?: { clientId: string; clientSecret: string };
  } = {};
  if (isProviderEnabled("google")) {
    options.google = {
      clientId: env("GOOGLE_CLIENT_ID")!,
      clientSecret: env("GOOGLE_CLIENT_SECRET")!,
    };
  }
  if (isProviderEnabled("apple")) {
    options.apple = {
      clientId: env("APPLE_CLIENT_ID")!,
      clientSecret: appleClientSecret({
        clientId: env("APPLE_CLIENT_ID")!,
        teamId: env("APPLE_TEAM_ID")!,
        keyId: env("APPLE_KEY_ID")!,
        privateKey: env("APPLE_PRIVATE_KEY")!,
      }),
    };
  }
  if (isProviderEnabled("facebook")) {
    options.facebook = {
      clientId: env("FACEBOOK_CLIENT_ID")!,
      clientSecret: env("FACEBOOK_CLIENT_SECRET")!,
    };
  }
  return options;
}
