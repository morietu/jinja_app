// apps/web/next.config.ts（統合版）
import type { NextConfig } from "next";

const API = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  trailingSlash: true,
  // ← monorepo 対策で既存のまま維持
  outputFileTracingRoot: __dirname,

  // 必要ならここに実験フラグを足していく
  experimental: {
    externalDir: true,
  },

  // 既存の画像設定はそのまま
  images: {
    domains: ["localhost", "xxx.s3.ap-northeast-1.amazonaws.com"],
    // もし remotePatterns を使う場合はここに追加（domains と併用可）
    // remotePatterns: [{ protocol: "https", hostname: "xxx.s3.ap-northeast-1.amazonaws.com" }],
  },

  // ★ 追加：バックエンドへのプロキシ（CORS回避 & 環境差分吸収）
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
