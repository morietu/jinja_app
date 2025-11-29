// apps/web/next.config.ts
import type { NextConfig } from "next";
import path from "path";

const isPlaywright = process.env.PLAYWRIGHT === "1";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  trailingSlash: false,
  skipTrailingSlashRedirect: true,

  // ★ 画像まわりの設定
  images: {
    // ローカルIPの画像最適化を許可
    dangerouslyAllowLocalIP: true,
    // 127.0.0.1:8000/media/goshuin/** を許可
    remotePatterns: [
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8000",
        pathname: "/media/goshuin/**",
      },
    ],
  },

  async rewrites() {
    if (isPlaywright) return [];
    const origin = process.env.NEXT_PUBLIC_BACKEND_ORIGIN || process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000";

    return [
      {
        source: "/api/:path*",
        destination: `${origin}/api/:path*/`,
      },
    ];
  },
};

export default nextConfig;
