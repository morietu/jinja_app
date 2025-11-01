// apps/web/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 互換レイヤ: /api/users/me/ → /api/me/
  if (pathname === "/api/users/me/" || pathname === "/api/users/me") {
    const url = req.nextUrl.clone();
    url.pathname = "/api/me/";
    return NextResponse.rewrite(url);
  }

  // ★ マイページ保護：access_token が無ければ /login へ
  if (pathname.startsWith("/mypage")) {
    const hasAccess = req.cookies.get("access_token")?.value;
    if (!hasAccess) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname + search); // もとの遷移先を保持
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/users/me/:path*",
    "/mypage",              // ここを追加
  ],
};
