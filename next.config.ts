import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["coolf2a.com", "50.47.90.121", "localhost", "coolf2a.com:3000", "50.47.90.121:3000", "localhost:3000"],
  transpilePackages: ["face-api.js"],
  devIndicators: {
    appIsrStatus: false,
  }
};

export default nextConfig;
