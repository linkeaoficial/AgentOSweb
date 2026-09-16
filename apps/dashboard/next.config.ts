import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/w/:id/widget.js", destination: "/widget.js" },
    ];
  },
};

export default nextConfig;
