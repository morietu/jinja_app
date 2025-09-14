// apps/web/next.config.ts（統合・修正済）
import type { NextConfig } from "next";

const API = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  trailingSlash: true,

  // monorepo 対策（既存の方針どおり）
  outputFileTracingRoot: __dirname,

  experimental: {
    externalDir: true,
  },

  images: {
    domains: ["localhost", "xxx.s3.ap-northeast-1.amazonaws.com"],
    // remotePatterns: [{ protocol: "https", hostname: "xxx.s3.ap-northeast-1.amazonaws.com" }],
  },

  // ✅ ESLint はトップレベルに置く
  eslint: {
    // Lint エラーがあっても本番ビルドは通す
    ignoreDuringBuilds: true,
  },

  // ★ バックエンドへのプロキシ（CORS回避 & 環境差異の吸収）
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
