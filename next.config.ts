import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page reads the session, so static-shell caching buys nothing here.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
