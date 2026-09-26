import "server-only";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { type FileStorage, publicBaseUrl, required } from "./index";

export function s3Storage(): FileStorage {
  const bucket = required("S3_BUCKET");
  const endpoint = process.env.S3_ENDPOINT; // omit for AWS S3
  const client = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false" && Boolean(endpoint),
    credentials: {
      accessKeyId: required("S3_ACCESS_KEY_ID"),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    },
    // Only send checksums when required: Supabase and Google Cloud Storage reject the newer defaults.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const base = publicBaseUrl(
    endpoint ? `${endpoint.replace(/\/+$/, "")}/${bucket}` : `https://${bucket}.s3.amazonaws.com`,
  );

  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    publicUrl(key) {
      return `${base}/${key}`;
    },
  };
}
