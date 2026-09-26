import "server-only";

import { BlobServiceClient } from "@azure/storage-blob";

import { type FileStorage, publicBaseUrl, required } from "./index";

export function azureStorage(): FileStorage {
  const service = BlobServiceClient.fromConnectionString(
    required("AZURE_STORAGE_CONNECTION_STRING"),
  );
  // The container must allow public read access for blobs ("Blob" access level), or sit behind a CDN.
  const container = service.getContainerClient(required("AZURE_STORAGE_CONTAINER"));
  const base = publicBaseUrl(container.url);

  return {
    async put(key, body, contentType) {
      await container.getBlockBlobClient(key).uploadData(body, {
        blobHTTPHeaders: {
          blobContentType: contentType,
          blobCacheControl: "public, max-age=31536000, immutable",
        },
      });
    },
    async delete(key) {
      await container.getBlockBlobClient(key).deleteIfExists();
    },
    publicUrl(key) {
      return `${base}/${key}`;
    },
  };
}
