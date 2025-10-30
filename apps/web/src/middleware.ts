// apps/web/src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// サーバーでは認証チェックしないパス（/mypage も許可）
const PUBLIC_PATHS = [
  "/login",
  "/",
  "/favicon.ico",
  "/robots.txt",
  "/_next",   // assets
  "/api",     // BFF/rewrites は素通し
  "/static",
  "/mypage",  // ← 暫定で許可
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // allowlist: PUBLIC_PATHS 配下は無条件通過
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // （ここに他ページ用のサーバー側認証チェックを入れるなら入れる）
  // 例:
  // const hasAccess = req.cookies.has("access_token");
  // if (!hasAccess) {
  //   const url = req.nextUrl.clone();
  //   url.pathname = "/login";
  //   url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  //   return NextResponse.redirect(url);
  // }

  return NextResponse.next();
}

// middleware の適用対象（静的アセット類は除外）
export const config = {
  matcher: ["/((?!_next/image|_next/static|favicon.ico).*)"],
};
