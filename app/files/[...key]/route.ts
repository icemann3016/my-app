import { readFile } from "node:fs/promises";
import path from "node:path";

import { LOCAL_STORAGE_DIR } from "@/lib/storage/local";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Serves files for STORAGE_DRIVER=local (development and tests). */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if ((process.env.STORAGE_DRIVER ?? "local") !== "local") {
    return new Response("Not found", { status: 404 });
  }
  const { key } = await params;
  const file = path.join(LOCAL_STORAGE_DIR, ...key);
  if (!file.startsWith(LOCAL_STORAGE_DIR + path.sep))
    return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(file);
    return new Response(body, {
      headers: {
        "content-type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
