import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Auth relies on per-request cookies, so keep rendering dynamic for now.
  // We can revisit cacheComponents once the data layer is in place.
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
