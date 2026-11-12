import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/nbadata.js",
        destination: "/api/data/script",
      },
    ];
  },
};

export default nextConfig;