import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/@:handle", destination: "/builders/:handle" }];
  },
};

export default nextConfig;
