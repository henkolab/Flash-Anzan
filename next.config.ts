import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Small self-contained server bundle for the Docker image.
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
