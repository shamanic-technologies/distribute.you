import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
  async redirects() {
    return [
      {
        source: "/features/:path*",
        destination: "/outcomes/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
