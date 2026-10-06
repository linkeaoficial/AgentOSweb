import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // En desarrollo se sirve el archivo crudo (como las docs, que usan <img>):
  // el optimizador de `next dev` dejó un webp corrupto en su caché y el logo
  // salía como "imagen rota" solo en Chrome. En producción sigue optimizado.
  images: { unoptimized: process.env.NODE_ENV === "development" },
  async rewrites() {
    return [
      { source: "/w/:id/widget.js", destination: "/widget.js" },
      { source: "/w/:id/imagen/:file", destination: "/imagen/:file" },
    ];
  },
};

export default nextConfig;
