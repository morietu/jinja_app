// apps/web/next.config.ts
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  trailingSlash: false,
  skipTrailingSlashRedirect: true,

  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      // ローカル開発用
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8000",
        pathname: "/media/goshuin/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8000",
        pathname: "/media/icons/**",
      },

      // 本番バックエンド用
      {
        protocol: "https",
        hostname: "jinja-backend.onrender.com",
        pathname: "/media/goshuin/**",
      },
      {
        protocol: "https",
        hostname: "jinja-backend.onrender.com",
        pathname: "/media/icons/**",
      },
    ],
  },

  async rewrites() {
    // rewrites は一旦なしのままでOK
    return [];
  },
};

export default nextConfig;
