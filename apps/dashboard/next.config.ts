import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/w/:id/widget.js", destination: "/widget.js" },
      { source: "/w/:id/imagen/:file", destination: "/imagen/:file" },
    ];
  },
};

export default nextConfig;
