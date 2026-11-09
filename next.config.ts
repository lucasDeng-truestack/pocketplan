import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page reads the session, so static-shell caching buys nothing here.
  cacheComponents: false,
  // The first tab is called Dashboard, so people type /dashboard.
  redirects: async () => [{ source: "/dashboard", destination: "/", permanent: true }],
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
