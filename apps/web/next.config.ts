// apps/web/next.config.ts
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  trailingSlash: false,
  skipTrailingSlashRedirect: true,

  //async rewrites() {
    // どちらか定義されている方を採用（NEXT_PUBLIC_ でも OK）
    //const origin =
      //process.env.NEXT_PUBLIC_BACKEND_ORIGIN ||
      //process.env.BACKEND_ORIGIN ||
      //"http://127.0.0.1:8000";

    //return [
      //{
        //source: "/api/:path*",
        //destination: `${origin}/api/:path*`,
      //},
    //];
  //},
};

export default nextConfig;
