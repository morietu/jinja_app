import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Django の起点（/api は Django 側に付いてる前提）
const ORIGIN = (
  process.env.API_BASE_SERVER ||
  process.env.BACKEND_ORIGIN ||
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

const SECURE = process.env.NODE_ENV === "production";

// /api を“剥がさず”透過。拡張子なしの /api/* は末尾 / を補完（Django の 301 を回避）
function toBackend(req: NextRequest) {
  let { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/") && !pathname.endsWith("/") && !/\.[A-Za-z0-9]+$/.test(pathname)) {
    pathname += "/";
  }
  return `${ORIGIN}${pathname}${search}`;
}

function stripHopByHop(h: Headers) {
  const out = new Headers(h);
  for (const k of [
    "content-length",
    "connection",
    "keep-alive",
    "proxy-connection",
    "transfer-encoding",
    "upgrade",
    "content-encoding",
  ]) out.delete(k);
  return out;
}

async function ALL(req: NextRequest) {
  // ヘルスチェック
  if (req.nextUrl.pathname === "/api/probe") {
    return NextResponse.json({ ok: true, via: "next", backend: `${ORIGIN}/api` });
  }

  // ログアウト（Cookie削除のみ）
  if (req.nextUrl.pathname === "/api/auth/logout" && req.method === "POST") {
    const out = NextResponse.json({ ok: true });
    out.cookies.set("access_token", "", { httpOnly: true, sameSite: "lax", secure: SECURE, path: "/", maxAge: 0 });
    out.cookies.set("refresh_token", "", { httpOnly: true, sameSite: "lax", secure: SECURE, path: "/", maxAge: 0 });
    return out;
  }

  try {
    // body 準備
    let body: BodyInit | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const ab = await req.arrayBuffer();
      body = ab.byteLength ? Buffer.from(ab) : undefined;
    }

    // ヘッダ整形
    const headers = new Headers(req.headers);
    headers.delete("host");
    headers.delete("content-length");
    headers.set("accept-encoding", "identity");

    // Cookie の access_token を Authorization へ（未指定のときだけ）
    if (!headers.has("authorization")) {
      const jwt = req.cookies.get("access_token")?.value;
      if (jwt) headers.set("authorization", `Bearer ${jwt}`);
    }

    // Upstream へ（301/302 は自動追従）
    const upstream = await fetch(toBackend(req), {
      method: req.method,
      headers,
      body,
      redirect: "follow",
      cache: "no-store",
      // @ts-ignore
      duplex: body ? "half" : undefined,
    });

    const buf = await upstream.arrayBuffer();
    const outHeaders = stripHopByHop(upstream.headers);
    outHeaders.set("content-length", String(buf.byteLength));

    const out = new NextResponse(buf, { status: upstream.status, headers: outHeaders });

    // Django の Set-Cookie も通す
    const any = upstream.headers as any;
    const setCookie = (typeof any.getSetCookie === "function" && any.getSetCookie()) || upstream.headers.get("set-cookie");
    if (Array.isArray(setCookie)) for (const c of setCookie) out.headers.append("set-cookie", c);
    else if (setCookie) out.headers.append("set-cookie", setCookie);

    return out;
  } catch (err: any) {
    console.error("[api proxy] error:", err);
    return NextResponse.json({ error: "proxy_failed", message: String(err?.message ?? err) }, { status: 502 });
  }
}

export { ALL as GET, ALL as POST, ALL as PUT, ALL as PATCH, ALL as DELETE, ALL as OPTIONS, ALL as HEAD };

console.log("[proxy] backend =", `${ORIGIN}/api`);
