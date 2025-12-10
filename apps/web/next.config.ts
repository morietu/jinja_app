// apps/web/next.config.ts
import type { NextConfig } from "next";
import path from "path";

const isPlaywright = process.env.PLAYWRIGHT === "1";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  trailingSlash: false,
  skipTrailingSlashRedirect: true,

  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
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
    ],
  },

  // 👇 ここを一旦こうする
  async rewrites() {
    // BFF デバッグのために一旦 rewrites 無し
    return [];
  },
};

export default nextConfig;
