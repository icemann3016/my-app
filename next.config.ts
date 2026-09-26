import type { NextConfig } from "next";

// Where uploaded images are served from (Supabase Storage, Google Cloud Storage, Azure Blob…).
const storageHost = process.env.STORAGE_PUBLIC_BASE_URL
  ? new URL(process.env.STORAGE_PUBLIC_BASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // Self-contained server build for Docker (Cloud Run, Azure Container Apps…): the Dockerfile
  // sets NEXT_OUTPUT=standalone. Vercel and `npm run start` use the normal build.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "*.blob.core.windows.net" },
      ...(storageHost ? [{ protocol: "https" as const, hostname: storageHost }] : []),
    ],
  },
};

export default nextConfig;
