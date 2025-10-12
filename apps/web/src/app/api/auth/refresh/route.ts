// apps/web/src/app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backendOrigin() {
  const raw =
    process.env.API_BASE_SERVER ||
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://127.0.0.1:8000";
  return raw.replace(/\/+$/, "").replace(/\/api\/?$/, "");
}

export async function POST(req: NextRequest) {
  // Cookie から refresh を読む（Bodyは不要）
  const refresh = req.cookies.get("refresh_token")?.value;
  if (!refresh) {
    return NextResponse.json({ detail: "no_refresh_cookie" }, { status: 400 });
  }

  // Django の SimpleJWT エンドポイントへ
  const upstream = await fetch(`${backendOrigin()}/api/auth/jwt/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "accept-encoding": "identity" },
    body: JSON.stringify({ refresh }),
    cache: "no-store",
  });

  // 返却準備
  let data: any = {};
  try {
    data = await upstream.json();
  } catch {
    // JSONでない場合は空オブジェクトのまま返す
  }
  const out = NextResponse.json(data, { status: upstream.status });

  // 成功時: access_token を更新（secure は本番のみ）
  if (upstream.ok && data?.access) {
    out.cookies.set("access_token", data.access, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60, // 1h
    });
  }
  return out;
}
