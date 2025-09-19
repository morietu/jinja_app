// apps/web/src/app/api/[[...path]]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORIGIN = (process.env.NEXT_PUBLIC_BACKEND_ORIGIN ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const SECURE = process.env.NODE_ENV === "production";

function backendUrl(req: NextRequest) {
  const { pathname, search } = req.nextUrl; // /api を剥がさない
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
    "content-encoding", // バッファ返却時は落とす
  ]) out.delete(k);
  return out;
}

function copySetCookie(src: Response, out: NextResponse) {
  const any = src.headers as any;
  const setCookie =
    (typeof any.getSetCookie === "function" && any.getSetCookie()) ||
    src.headers.get("set-cookie");
  if (Array.isArray(setCookie)) {
    for (const c of setCookie) out.headers.append("set-cookie", c);
  } else if (setCookie) {
    out.headers.append("set-cookie", setCookie);
  }
}

async function ALL(req: NextRequest) {
  // /api ゼロパス用 & ヘルスチェック
  if (req.nextUrl.pathname === "/api" || req.nextUrl.pathname === "/api/") {
    return NextResponse.redirect(new URL("/api/", req.url));
  }
  if (req.nextUrl.pathname === "/api/__probe__") {
    return NextResponse.json({ ok: true, via: "next" });
  }

  // リクエストボディ
  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const ab = await req.arrayBuffer();
    body = ab.byteLength ? Buffer.from(ab) : undefined;
  }

  // ヘッダ整形
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.set("accept-encoding", "identity"); // 圧縮禁止で安定化

  // Cookie → Authorization
  if (!headers.has("authorization")) {
    const jwt = req.cookies.get("access_token")?.value;
    if (jwt) headers.set("authorization", `Bearer ${jwt}`);
  }

  // 上流へ
  const upstream = await fetch(backendUrl(req), {
    method: req.method,
    headers,
    body,
    redirect: "follow",
    cache: "no-store",
    // @ts-ignore
    duplex: body ? "half" : undefined,
  });

  // すべてバッファ
  const buf = await upstream.arrayBuffer();

  // 返却ヘッダ
  const outHeaders = stripHopByHop(upstream.headers);
  outHeaders.set("content-length", String(buf.byteLength));
  outHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  outHeaders.set("Pragma", "no-cache");

  const out = new NextResponse(buf, { status: upstream.status, headers: outHeaders });

  // JWT create/refresh の時だけ Cookie を付与
  const p = req.nextUrl.pathname;
  const isJwt = /\/api\/auth\/jwt\/(create|refresh)\/?$/i.test(p);
  if (req.method === "POST" && isJwt && upstream.ok) {
    try {
      const data = JSON.parse(new TextDecoder().decode(buf));
      if (data?.access) {
        out.cookies.set("access_token", data.access, {
          httpOnly: true, sameSite: "lax", secure: SECURE, path: "/", maxAge: 60 * 60,
        });
      }
      if (data?.refresh) {
        out.cookies.set("refresh_token", data.refresh, {
          httpOnly: true, sameSite: "lax", secure: SECURE, path: "/", maxAge: 14 * 24 * 60 * 60,
        });
      }
    } catch { /* ignore */ }
  }

  copySetCookie(upstream, out);
  return out;
}

export { ALL as GET, ALL as POST, ALL as PUT, ALL as PATCH, ALL as DELETE, ALL as OPTIONS, ALL as HEAD };
