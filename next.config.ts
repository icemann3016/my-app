import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Profile photos and (later) aircraft photos from Supabase Storage.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
