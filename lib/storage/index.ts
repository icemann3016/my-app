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
 * - "local" (default): files in ./.data, public ones served by /files/*. Development and tests only.
 *
 * Two kinds of storage:
 * - "public": photos anyone may see (public bucket, `publicUrl`).
 * - "private": pilot and aircraft documents. Never linked directly: the app reads them with `get`
 *   and serves them after checking who is asking (see app/api/documents).
 */
export type StorageKind = "public" | "private";

export interface FileStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** The file's bytes and type, or null if it doesn't exist. */
  get(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
  delete(key: string): Promise<void>;
  /** URL where anyone can view a file. Public storage only. */
  publicUrl(key: string): string;
}

const instances = new Map<StorageKind, FileStorage>();

export function getStorage(kind: StorageKind = "public"): FileStorage {
  let instance = instances.get(kind);
  if (!instance) {
    const driver = process.env.STORAGE_DRIVER ?? "local";
    if (driver === "s3") instance = s3Storage(kind);
    else if (driver === "azure") instance = azureStorage(kind);
    else if (driver === "local") instance = localStorage(kind);
    else throw new Error(`Unknown STORAGE_DRIVER "${driver}"`);
    instances.set(kind, instance);
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

export function noPublicUrl(): never {
  throw new Error("Private files have no public URL; serve them through the app.");
}
