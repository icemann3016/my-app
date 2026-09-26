import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { FileStorage, StorageKind } from "./index";
import { noPublicUrl } from "./index";

export const LOCAL_STORAGE_DIR = path.join(process.cwd(), ".data", "uploads");
const LOCAL_PRIVATE_DIR = path.join(process.cwd(), ".data", "private");

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

/** Stores files on the server's disk. Development and tests only: not for real deployments. */
export function localStorage(kind: StorageKind): FileStorage {
  const root = kind === "private" ? LOCAL_PRIVATE_DIR : LOCAL_STORAGE_DIR;
  const resolve = (key: string) => {
    const file = path.join(root, key);
    if (!file.startsWith(root + path.sep)) throw new Error("Invalid key");
    return file;
  };

  return {
    async put(key, body) {
      const file = resolve(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
    },
    async get(key) {
      try {
        const body = await readFile(resolve(key));
        return {
          body: new Uint8Array(body),
          contentType: TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream",
        };
      } catch {
        return null;
      }
    },
    async delete(key) {
      await rm(resolve(key), { force: true });
    },
    publicUrl(key) {
      if (kind === "private") noPublicUrl();
      return `/files/${key}`;
    },
  };
}
