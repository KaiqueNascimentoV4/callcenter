import type { NextConfig } from "next";

/** Base URL do Express (Docker em api-call, ou localhost). Configuração na Vercel: `BACKEND_PROXY_TARGET`. */
function backendProxyTarget(): string {
  return (
    process.env.BACKEND_PROXY_TARGET?.replace(/\/$/, "") ??
    "https://api-call.v4companyamaral.com"
  );
}

/**
 * Proxy estável: `rewrites()` para upstream externo costuma ser mais fiável na Vercel
 * do que Route Handler + fetch (menos 404 em rotas opcionais e menos cold-start proxy).
 * Local: `.env.local` → `BACKEND_PROXY_TARGET=http://127.0.0.1:3001` (porta do Dockerfile da API).
 */
const nextConfig: NextConfig = {
  async rewrites() {
    const base = backendProxyTarget();
    return [
      {
        source: "/api-ext/:path*",
        destination: `${base}/:path*`,
      },
    ];
  },
};

export default nextConfig;
