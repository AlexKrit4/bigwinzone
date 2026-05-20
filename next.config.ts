import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/books-api/:path*",
        destination: "http://127.0.0.1:3847/:path*",
      },
    ];
  },
};

export default nextConfig;
