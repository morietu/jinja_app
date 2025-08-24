import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  experimental: {
    appDir: true,   // ← App Router を強制的に有効化
  },
};

export default nextConfig;
