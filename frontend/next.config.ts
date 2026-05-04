import type { NextConfig } from "next";

/**
 * O proxy `/api-ext/*` → backend está em `app/api-ext/[[...path]]/route.ts`
 * (timeout configurável + `maxDuration` na Vercel).
 *
 * Variável na Vercel: `BACKEND_PROXY_TARGET=https://api-call...` (sem barra final).
 */
const nextConfig: NextConfig = {};

export default nextConfig;
