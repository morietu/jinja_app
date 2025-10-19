// apps/web/src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // ここに来る時点で config.matcher を通過済み = 保護対象
  const hasAccess = req.cookies.has("access_token");
  if (hasAccess) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url); // 307
}

export const config = {
  matcher: ["/mypage/:path*", "/my/:path*"],
};
