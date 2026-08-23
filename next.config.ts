import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.horasard.com" }],
        destination: "https://horasard.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
