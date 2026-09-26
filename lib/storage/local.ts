import "server-only";

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { FileStorage } from "./index";

export const LOCAL_STORAGE_DIR = path.join(process.cwd(), ".data", "uploads");

/** Stores files on the server's disk. Development and tests only: not for real deployments. */
export function localStorage(): FileStorage {
  const resolve = (key: string) => {
    const file = path.join(LOCAL_STORAGE_DIR, key);
    if (!file.startsWith(LOCAL_STORAGE_DIR + path.sep)) throw new Error("Invalid key");
    return file;
  };

  return {
    async put(key, body) {
      const file = resolve(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
    },
    async delete(key) {
      await rm(resolve(key), { force: true });
    },
    publicUrl(key) {
      return `/files/${key}`;
    },
  };
}
