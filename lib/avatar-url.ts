import "server-only";

import { presetFromKey, presetUrl } from "@/lib/avatar-presets";
import { getStorage } from "@/lib/storage";

/** URL of an avatar: a ready-made one from public/avatars, or an uploaded photo. Null if none. */
export function avatarUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith("preset:")) {
    const preset = presetFromKey(key);
    return preset ? presetUrl(preset) : null;
  }
  return getStorage().publicUrl(key);
}
