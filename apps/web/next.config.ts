import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  experimental: {},
  images: {
    domains: ["localhost", "xxx.s3.ap-northeast-1.amazonaws.com"],
  },
};

export default nextConfig;
