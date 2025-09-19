// apps/web/next.config.ts
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  trailingSlash: false,
  skipTrailingSlashRedirect: true, // ← ここに統合
};

export default nextConfig;
