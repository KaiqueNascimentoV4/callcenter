import type { NextConfig } from "next";

/** Proxy da API em produção: `app/api-ext/[[...path]]/route.ts` (runtime node).
 * Local: defina `BACKEND_PROXY_TARGET=http://127.0.0.1:3000` no `.env.local`. */
const nextConfig: NextConfig = {};

export default nextConfig;
