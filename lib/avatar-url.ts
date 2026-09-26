import "server-only";

import { getStorage } from "@/lib/storage";

/** Public URL of a stored avatar, or null. */
export function avatarUrl(key: string | null | undefined): string | null {
  return key ? getStorage().publicUrl(key) : null;
}
