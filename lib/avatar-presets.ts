// Ready-made avatars people can pick instead of uploading a photo (files in public/avatars).
// A chosen preset is stored in profiles.avatar_key as "preset:<name>".

export const AVATAR_PRESETS = [
  "light-aircraft",
  "biplane",
  "jet",
  "helicopter",
  "glider",
  "balloon",
  "propeller",
  "windsock",
  "compass",
  "headset",
] as const;

export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

export const isAvatarPreset = (value: unknown): value is AvatarPreset =>
  typeof value === "string" && (AVATAR_PRESETS as readonly string[]).includes(value);

export const presetKey = (preset: AvatarPreset) => `preset:${preset}`;

/** The preset in an avatar key, or null for an uploaded photo (or an unknown preset). */
export function presetFromKey(key: string | null | undefined): AvatarPreset | null {
  const name = key?.startsWith("preset:") ? key.slice("preset:".length) : null;
  return isAvatarPreset(name) ? name : null;
}

export const presetUrl = (preset: AvatarPreset) => `/avatars/${preset}.svg`;
