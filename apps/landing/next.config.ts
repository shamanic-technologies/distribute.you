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
  async redirects() {
    return [
      // Old multi-feature performance sub-views collapsed into one page.
      { source: "/performance/brands", destination: "/performance", permanent: true },
      { source: "/performance/models", destination: "/performance", permanent: true },
      { source: "/performance/prompts", destination: "/performance", permanent: true },
      { source: "/docs/api", destination: "https://api.distribute.you/docs", permanent: false },
      { source: "/docs/mcp", destination: "https://docs.distribute.you/mcp", permanent: false },
      { source: "/docs", destination: "https://docs.distribute.you", permanent: false },
      { source: "/sign-in", destination: "https://dashboard.distribute.you/sign-in", permanent: false },
      { source: "/sign-up", destination: "https://dashboard.distribute.you/sign-up", permanent: false },
    ];
  },
};

export default nextConfig;
