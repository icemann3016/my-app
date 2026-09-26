import "server-only";

import { azureStorage } from "./azure";
import { localStorage } from "./local";
import { s3Storage } from "./s3";

/**
 * File storage behind one small interface, so the provider can change with configuration.
 * STORAGE_DRIVER:
 * - "s3": any S3-compatible service: Supabase Storage, Google Cloud Storage (interoperability
 *         mode), AWS S3, Cloudflare R2, MinIO.
 * - "azure": Azure Blob Storage.
 * - "local" (default): files in ./.data/uploads, served by /files/*. Development and tests only.
 */
export interface FileStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** URL where anyone can view a public file. */
  publicUrl(key: string): string;
}

let instance: FileStorage | undefined;

export function getStorage(): FileStorage {
  if (!instance) {
    const driver = process.env.STORAGE_DRIVER ?? "local";
    instance =
      driver === "s3"
        ? s3Storage()
        : driver === "azure"
          ? azureStorage()
          : driver === "local"
            ? localStorage()
            : (() => {
                throw new Error(`Unknown STORAGE_DRIVER "${driver}"`);
              })();
  }
  return instance;
}

export function publicBaseUrl(fallback: string): string {
  return (process.env.STORAGE_PUBLIC_BASE_URL ?? fallback).replace(/\/+$/, "");
}

export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (needed for STORAGE_DRIVER).`);
  return value;
}
