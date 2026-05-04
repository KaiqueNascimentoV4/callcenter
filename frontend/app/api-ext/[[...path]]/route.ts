import { NextRequest, NextResponse } from "next/server";

/** Plano Hobby na Vercel costuma limitar a ~10s; Pro/Enterprise permitem mais — ver dashboard. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function backendBase(): string {
  return (
    process.env.BACKEND_PROXY_TARGET?.replace(/\/$/, "") ??
    "https://api-call.v4companyamaral.com"
  );
}

const PROXY_MS = 55_000;

async function proxy(req: NextRequest, pathSegments: string[] | undefined) {
  const path = pathSegments?.length ? pathSegments.join("/") : "";
  const url = new URL(req.url);
  const destUrl = `${backendBase()}/${path}${url.search}`;

  const headers = new Headers();
  for (const name of ["content-type", "authorization", "accept", "cookie"]) {
    const v = req.headers.get(name);
    if (v) headers.set(name, v);
  }

  let body: ArrayBuffer | undefined;
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const buf = await req.arrayBuffer();
    if (buf.byteLength) body = buf;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROXY_MS);

  let res: Response;
  try {
    res = await fetch(destUrl, {
      method: req.method,
      headers,
      body: body?.byteLength ? body : undefined,
      cache: "no-store",
      signal: ctrl.signal,
    });
  } catch (e) {
    console.error("[api-ext]", destUrl, e);
    return NextResponse.json(
      {
        error:
          "Não foi possível contactar a API (timeout ou rede). Confirme o contentor no Portainer e BACKEND_PROXY_TARGET na Vercel.",
        detail: String(e),
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timer);
  }

  const out = new Headers();
  const ct = res.headers.get("content-type");
  if (ct) out.set("content-type", ct);

  return new NextResponse(await res.arrayBuffer(), {
    status: res.status,
    headers: out,
  });
}

type Ctx = { params: Promise<{ path?: string[] }> };

async function handle(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;
