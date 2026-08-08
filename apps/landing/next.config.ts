import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The landing ships as a container on the Hetzner box, so the build emits a
  // self-contained server plus only the traced dependencies. `next build` runs with
  // apps/landing as its cwd, and the trace root has to be the monorepo root or the
  // standalone output misses everything pnpm hoisted above this package — including
  // @distribute/content, which every served page reads its copy from.
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
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
      { source: "/sign-in", destination: "https://dashboard.distribute.you/sign-in", permanent: false },
      { source: "/sign-up", destination: "https://dashboard.distribute.you/sign-up", permanent: false },
    ];
  },
};

export default nextConfig;
