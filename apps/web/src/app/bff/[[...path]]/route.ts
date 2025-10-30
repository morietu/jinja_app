// apps/web/src/app/api/[[...path]]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────
// 1) 絶対URLだけ採用するセーフティ
function firstAbsolute(...cands: (string | undefined)[]) {
  for (const c of cands) if (c && /^https?:\/\//i.test(c)) return c;
  return undefined;
}

// 2) ORIGIN 決定（末尾のスラッシュ / および /api を除去）
const RAW_ORIGIN =
  firstAbsolute(
    process.env.API_BASE_SERVER,
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN,
    process.env.NEXT_PUBLIC_API_BASE
  ) || (process.env.NODE_ENV !== "production" ? "http://127.0.0.1:8000" : "");

if (!RAW_ORIGIN) {
  throw new Error("API_BASE_SERVER is required in production");
}

const ORIGIN = RAW_ORIGIN.replace(/\/+$/, "").replace(/\/api\/?$/, "");

// 3) 本番のみ secure（Cookie設定用）
const SECURE = process.env.NODE_ENV === "production";

// 4) Next の /api を剥がさずにそのまま Django 側へ流す
function toBackend(req: NextRequest) {
  const { pathname, search } = req.nextUrl; // e.g. /api/users/me/
  return `${ORIGIN}${pathname}${search}`;   // e.g. http://127.0.0.1:8000/api/users/me/
}

// Hop-by-hop（と圧縮ヘッダ）を落として Next に再計算させる
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

  // ログアウト（Cookie削除）
  if (req.nextUrl.pathname === "/api/auth/logout" && req.method === "POST") {
    const out = NextResponse.json({ ok: true });
    out.cookies.set("access_token", "", { httpOnly: true, sameSite: "lax", secure: SECURE, path: "/", maxAge: 0 });
    out.cookies.set("refresh_token", "", { httpOnly: true, sameSite: "lax", secure: SECURE, path: "/", maxAge: 0 });
    return out;
  }

  // Cookie可視化
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

    // --- リクエストボディ準備（GET/HEAD以外）--- ※ここだけ残す
    let body: BodyInit | undefined;
    let bodyLen = 0;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const ab = await req.arrayBuffer();
      bodyLen = ab.byteLength;
      body = bodyLen ? Buffer.from(ab) : undefined;
    }
    console.log("[proxy]", req.method, req.nextUrl.pathname, "bodyLen=", bodyLen);
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
