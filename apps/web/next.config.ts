// apps/web/next.config.ts
import type { NextConfig } from "next";
import path from "path";

const isPlaywright = process.env.PLAYWRIGHT === "1";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
  async rewrites() {
    if (isPlaywright) return [];
    const origin = process.env.NEXT_PUBLIC_BACKEND_ORIGIN || process.env.BACKEND_ORIGIN || "http://localhost:8000";

    return [
      {
        source: "/api/:path*",
        // ★ ここを変更：:path* のあとに `/` を付ける
        destination: `${origin}/api/:path*/`,
      },
    ];
  },
};

export default nextConfig;
