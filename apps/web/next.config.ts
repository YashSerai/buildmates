import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/@:handle", destination: "/builders/:handle", permanent: true }];
  },
};

export default nextConfig;
