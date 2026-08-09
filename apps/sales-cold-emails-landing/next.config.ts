import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // One page, no dynamic segment, no API route, no database, no middleware — so
  // it is emitted as plain files and served by any static host rather than by a
  // Node runtime it never uses.
  output: "export",
  // Static export has no image optimizer, so the loader is disabled explicitly
  // (the build fails otherwise instead of silently degrading). `remotePatterns`
  // is kept: it still governs which hosts `next/image` will accept a src from.
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "distribute.you",
      },
    ],
  },
  // Emits `index.html` per directory, which is what a static host resolves for a
  // path without per-route rewrite rules.
  trailingSlash: true,
};

export default nextConfig;
