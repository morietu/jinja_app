// apps/web/next.config.ts
import type { NextConfig } from "next";
import path from "path";

// R2のパブリックURLを環境変数から取得（オプション）
const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;
const r2Hostname = r2PublicUrl
  ? new URL(r2PublicUrl).hostname
  : null;

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  trailingSlash: false,
  skipTrailingSlashRedirect: true,

  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      // ローカル開発（Django media）
      { protocol: "http", hostname: "127.0.0.1", port: "8000", pathname: "/media/**" },
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/media/**" },

      // 本番バックエンド
      { protocol: "https", hostname: "jinja-backend.onrender.com", pathname: "/media/**" },

      // R2固定（直URL使うなら）
      { protocol: "https", hostname: "pub-2bcf3477e26d46f6ab5031df3b436f92.r2.dev", pathname: "/**" },

      

      // envで渡すR2
      ...(r2Hostname ? [{ protocol: "https" as const, hostname: r2Hostname, pathname: "/**" }] : []),
    ],
  },

  async rewrites() {
    // rewrites は一旦なしのままでOK
    return [];
  },
};

export default nextConfig;
