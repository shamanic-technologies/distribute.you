import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  reactStrictMode: true,
  // Emitted as plain files so this can be served by any static host. Nothing here
  // needs a server: 28 MDX routes, no dynamic segments, no API route, no database,
  // no middleware, and no request-time API (`cookies`, `headers`, `revalidate`).
  // Paying for a Node runtime to hand back documents that never change between
  // builds is the whole reason this moved off Vercel.
  output: "export",
  // `next/image`'s optimizer is a server. Static export has none, so the loader
  // must be disabled explicitly or the build fails rather than silently degrading.
  images: { unoptimized: true },
  // Emits `about/index.html` instead of `about.html`, which is what a static host
  // resolves for `/about` without per-path rewrite rules.
  trailingSlash: true,
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

export default withMDX(nextConfig);
