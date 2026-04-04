import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*", "coolf2a.com"],
  transpilePackages: ["face-api.js"],
};

export default nextConfig;
