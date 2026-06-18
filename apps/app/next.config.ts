import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root: avoids Next inferring a stray external lockfile.
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
