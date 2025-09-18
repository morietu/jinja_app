// apps/web/next.config.ts
import type { NextConfig } from "next";

const RAW = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
const ORIGIN = RAW.replace(/\/+$/, "").replace(/\/api$/i, "");

const nextConfig: NextConfig = {
  trailingSlash: true,
  outputFileTracingRoot: __dirname,
  experimental: { externalDir: true },
  images: { domains: ["localhost", "xxx.s3.ap-northeast-1.amazonaws.com"] },
  eslint: { ignoreDuringBuilds: true },

  async rewrites() {
    const origin = ORIGIN.replace(/\/+$/, "");
    return [
      // /api をジャストで叩かれたとき
      { source: "/api", destination: `${origin}/api/` },
      // /api/xxx/（スラあり）
      { source: "/api/:path*/", destination: `${origin}/api/:path*/` },
      // /api/xxx（スラなし）
      { source: "/api/:path*", destination: `${origin}/api/:path*` },
    ];
  },
};

export default nextConfig;
