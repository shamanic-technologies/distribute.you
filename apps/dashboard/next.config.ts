import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next 16.4 type-checks every file tsconfig.json includes, tests too; 16.2 did not.
  // The build keeps checking app code only (tests are checked by vitest + tsc).
  typescript: { tsconfigPath: "tsconfig.build.json" },
  // The customer dashboard ships as a container on the Hetzner box, so the build emits
  // a self-contained server plus only the traced dependencies. `next build` runs with
  // apps/dashboard as its cwd, and the trace root has to be the monorepo root or the
  // standalone output misses everything pnpm hoisted above this package.
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "images.clerk.dev",
      },
    ],
  },
  async headers() {
    return [
      {
        // Public client reports — keep out of search engines and AI crawlers
        source: "/report/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet, noai, noimageai",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
