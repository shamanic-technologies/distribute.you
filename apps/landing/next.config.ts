import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.logo.dev",
      },
      {
        protocol: "https",
        hostname: "unavatar.io",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
  },
  // /benchmarks was consolidated into the single /performance page (sales cold
  // email is the only GA product). 301 the old URLs to preserve SEO + links.
  async redirects() {
    return [
      { source: "/benchmarks", destination: "/performance", permanent: true },
      { source: "/benchmarks/:slug*", destination: "/performance", permanent: true },
      // Old multi-feature performance sub-views collapsed into one page.
      { source: "/performance/brands", destination: "/performance", permanent: true },
      { source: "/performance/models", destination: "/performance", permanent: true },
      { source: "/performance/prompts", destination: "/performance", permanent: true },
    ];
  },
};

export default nextConfig;
