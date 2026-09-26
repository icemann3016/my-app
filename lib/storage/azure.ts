import "server-only";

import { BlobServiceClient, RestError } from "@azure/storage-blob";

import { type FileStorage, noPublicUrl, publicBaseUrl, required, type StorageKind } from "./index";

export function azureStorage(kind: StorageKind): FileStorage {
  const service = BlobServiceClient.fromConnectionString(
    required("AZURE_STORAGE_CONNECTION_STRING"),
  );
  // The public container needs "Blob" (public read) access; the private one must stay private.
  const container = service.getContainerClient(
    kind === "private"
      ? required("AZURE_STORAGE_PRIVATE_CONTAINER")
      : required("AZURE_STORAGE_CONTAINER"),
  );
  const base = publicBaseUrl(container.url);

  return {
    async put(key, body, contentType) {
      await container.getBlockBlobClient(key).uploadData(body, {
        blobHTTPHeaders: {
          blobContentType: contentType,
          blobCacheControl:
            kind === "public" ? "public, max-age=31536000, immutable" : "private, no-store",
        },
      });
    },
    async get(key) {
      const blob = container.getBlockBlobClient(key);
      try {
        const [body, props] = await Promise.all([blob.downloadToBuffer(), blob.getProperties()]);
        return {
          body: new Uint8Array(body),
          contentType: props.contentType ?? "application/octet-stream",
        };
      } catch (error) {
        if (error instanceof RestError && error.statusCode === 404) return null;
        throw error;
      }
    },
    async delete(key) {
      await container.getBlockBlobClient(key).deleteIfExists();
    },
    publicUrl(key) {
      if (kind === "private") noPublicUrl();
      return `${base}/${key}`;
    },
  };
}
