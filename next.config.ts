import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/books-api/:path*",
        destination: "http://127.0.0.1:3847/:path*",
      },
      {
        source: "/xboot-books-api/:path*",
        destination: "http://127.0.0.1:3848/:path*",
      },
    ];
  },
};

export default nextConfig;
