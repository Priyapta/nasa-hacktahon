import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const apiUrl = (process.env.API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const config: NextConfig = {
  transpilePackages: ["@field-atlas/shared"],
  turbopack: { root: fileURLToPath(new URL("..", import.meta.url)) },
  // The input flow used to live at /?langkah=…; old shared links keep working.
  async redirects() {
    return ["langkah", "area", "pola", "lahan", "mulai", "horizon", "air"].map((key) => ({
      source: "/",
      has: [{ type: "query" as const, key }],
      destination: "/lahan",
      permanent: false,
    }));
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default config;
