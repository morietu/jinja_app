// apps/web/src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // Cookie を削除
  res.cookies.set("access_token", "", { path: "/", maxAge: 0 });
  res.cookies.set("refresh_token", "", { path: "/", maxAge: 0 });
  return res;
}

// （任意）動作確認用
export async function GET() {
  return NextResponse.json({ ok: true, via: "logout-route" });
}
