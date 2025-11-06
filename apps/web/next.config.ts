// apps/web/next.config.ts
import type { NextConfig } from "next";
import path from "path";

const isPlaywright = process.env.PLAYWRIGHT === "1";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
  async rewrites() {
    if (isPlaywright) return []; // E2E時は Next の /app/api を使う
    const origin =
      process.env.NEXT_PUBLIC_BACKEND_ORIGIN ||
      process.env.BACKEND_ORIGIN ||
      "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${origin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
