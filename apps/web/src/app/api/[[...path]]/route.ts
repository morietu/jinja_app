// apps/web/src/app/api/[[...path]]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORIGIN = (
  process.env.API_BASE_SERVER ||
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

// 本番のみ secure。ローカルは false
const SECURE = process.env.NODE_ENV === "production";

// /api を剥がさず、そのまま Django 側へ
function toBackend(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  return `${ORIGIN}${pathname}${search}`;
}

// hop-by-hop（と圧縮ヘッダ）を落として Next に再計算させる
function stripHopByHop(h: Headers) {
  const out = new Headers(h);
  for (const k of [
    "content-length",
    "connection",
    "keep-alive",
    "proxy-connection",
    "transfer-encoding",
    "upgrade",
    "content-encoding", // バッファ返却時は外す
  ]) out.delete(k);
  return out;
}

export async function ALL(req: NextRequest) {
  // ヘルスチェック / Cookie デバッグ
  if (req.nextUrl.pathname === "/api/probe") {
    return NextResponse.json({ ok: true, via: "next", origin: ORIGIN });
  }
  if (req.nextUrl.pathname === "/api/auth/logout" && req.method === "POST") {
  const out = NextResponse.json({ ok: true });
  // Cookie を削除
  out.cookies.set("access_token", "", { httpOnly: true, sameSite: "lax", secure: SECURE, path: "/", maxAge: 0 });
  out.cookies.set("refresh_token", "", { httpOnly: true, sameSite: "lax", secure: SECURE, path: "/", maxAge: 0 });
  return out;
}
  if (req.nextUrl.pathname === "/api/debug/cookies") {
    const access = req.cookies.get("access_token")?.value ?? null;
    const refresh = req.cookies.get("refresh_token")?.value ?? null;
    return NextResponse.json({
      saw_access_cookie: !!access,
      access_len: access?.length ?? 0,
      saw_refresh_cookie: !!refresh,
      refresh_len: refresh?.length ?? 0,
      authorization_header: req.headers.get("authorization"),
    });
  }

  try {
    // --- リクエストボディ準備（GET/HEAD以外） ---
    let body: BodyInit | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const ab = await req.arrayBuffer();
      body = ab.byteLength ? Buffer.from(ab) : undefined;
    }

    // --- ヘッダー整形 ---
    const headers = new Headers(req.headers);
    headers.delete("host");
    headers.delete("content-length");
    // 圧縮で不具合が出る環境なら identity を固定
    headers.set("accept-encoding", "identity");

    // Cookie access_token → Authorization（未指定時のみ）
    if (!headers.has("authorization")) {
      const jwt = req.cookies.get("access_token")?.value;
      if (jwt) headers.set("authorization", `Bearer ${jwt}`);
    }

    // --- Upstream へ ---
    const upstream = await fetch(toBackend(req), {
      method: req.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
      // @ts-ignore
      duplex: body ? "half" : undefined,
    });

    // --- 全バッファ ---
    const buf = await upstream.arrayBuffer();

    // --- 返却ヘッダー ---
    const outHeaders = stripHopByHop(upstream.headers);
    outHeaders.set("content-length", String(buf.byteLength));
    const out = new NextResponse(buf, { status: upstream.status, headers: outHeaders });

    // JWT create/refresh の時だけ Cookie を自前で付与
    const isJwt = /\/api\/auth\/jwt\/(create|refresh)\/?$/i.test(req.nextUrl.pathname);
    if (req.method === "POST" && isJwt && upstream.ok) {
      try {
        const data = JSON.parse(new TextDecoder().decode(buf));
        if (data?.access) {
          out.cookies.set("access_token", data.access, {
            httpOnly: true, sameSite: "lax", secure: SECURE, path: "/", maxAge: 60 * 60, // 1h
          });
        }
        if (data?.refresh) {
          out.cookies.set("refresh_token", data.refresh, {
            httpOnly: true, sameSite: "lax", secure: SECURE, path: "/", maxAge: 14 * 24 * 60 * 60, // 14d
          });
        }
      } catch { /* JSON でない場合は無視 */ }
    }

    // Django 側の Set-Cookie も通す（複数対応）
    const any = upstream.headers as any;
    const setCookie =
      (typeof any.getSetCookie === "function" && any.getSetCookie()) ||
      upstream.headers.get("set-cookie");
    if (Array.isArray(setCookie)) {
      for (const c of setCookie) out.headers.append("set-cookie", c);
    } else if (setCookie) {
      out.headers.append("set-cookie", setCookie);
    }

    return out;
  } catch (err: any) {
    console.error("[api proxy] error:", err);
    return NextResponse.json(
      { error: "proxy_failed", message: String(err?.message ?? err) },
      { status: 502 }
    );
  }
}

export { ALL as GET, ALL as POST, ALL as PUT, ALL as PATCH, ALL as DELETE, ALL as OPTIONS, ALL as HEAD };
