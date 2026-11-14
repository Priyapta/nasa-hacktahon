import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const apiUrl = (process.env.API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const config: NextConfig = {
  transpilePackages: ["@field-atlas/shared"],
  turbopack: { root: fileURLToPath(new URL("..", import.meta.url)) },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default config;
