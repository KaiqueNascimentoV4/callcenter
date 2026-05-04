import type { NextConfig } from "next";

/** Destino do proxy /api-ext (servidor → servidor, sem CORS no browser). Override local: BACKEND_PROXY_TARGET=http://127.0.0.1:3000 */
const backendUrl =
  process.env.BACKEND_PROXY_TARGET?.replace(/\/$/, "") ??
  "https://api-call.v4companyamaral.com";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api-ext/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
