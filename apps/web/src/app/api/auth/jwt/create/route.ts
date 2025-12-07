// apps/web/src/app/api/auth/jwt/create/route.ts
import { NextRequest, NextResponse } from "next/server";

const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_BACKEND_ORIGIN ?? "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  // フロントから受け取ったJSONボディ
  const body = await req.json();

  // Django の JWT エンドポイントを叩く
  const r = await fetch(`${BACKEND_ORIGIN}/api/auth/jwt/create/`, {
    method: "POST",
    headers: { "content-type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  const data = await r.json();

  if (!r.ok) {
    // 認証失敗（400/401など）
    return NextResponse.json(data, { status: r.status });
  }

  const { access, refresh } = data;

  const res = NextResponse.json({ ok: true });

  // HttpOnly Cookie に保存
  res.cookies.set("access_token", access, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: false, // 本番では true
    maxAge: 60 * 60, // 1時間など
  });

  res.cookies.set("refresh_token", refresh, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: false,
    maxAge: 7 * 24 * 60 * 60, // 7日など
  });

  return res;
}
