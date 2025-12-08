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
