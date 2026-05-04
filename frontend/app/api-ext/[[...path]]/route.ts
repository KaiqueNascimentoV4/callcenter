import { NextRequest, NextResponse } from "next/server";

/** Proxy explícito: mais estável na Vercel do que `rewrites()` para host externo. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backendBase(): string {
  return (
    process.env.BACKEND_PROXY_TARGET?.replace(/\/$/, "") ??
    "https://api-call.v4companyamaral.com"
  );
}

async function proxy(req: NextRequest, pathSegments: string[] | undefined) {
  const path = pathSegments?.length ? pathSegments.join("/") : "";
  const url = new URL(req.url);
  const destUrl = `${backendBase()}/${path}${url.search}`;

  const headers = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);

  let body: ArrayBuffer | undefined;
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const buf = await req.arrayBuffer();
    if (buf.byteLength) body = buf;
  }

  let res: Response;
  try {
    res = await fetch(destUrl, {
      method: req.method,
      headers,
      body: body?.byteLength ? body : undefined,
      cache: "no-store",
    });
  } catch (e) {
    console.error("[api-ext]", destUrl, e);
    return NextResponse.json(
      { error: "Falha ao contactar a API (upstream)", detail: String(e) },
      { status: 502 }
    );
  }

  const out = new Headers();
  const outCt = res.headers.get("content-type");
  if (outCt) out.set("content-type", outCt);

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
