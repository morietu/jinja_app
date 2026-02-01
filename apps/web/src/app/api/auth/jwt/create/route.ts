// apps/web/src/app/api/auth/jwt/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const upstream = await djFetch(req, "/api/auth/jwt/create/", {
    method: "POST",
    headers: { "content-type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  const data = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    return NextResponse.json(data ?? { error: "upstream_failed" }, { status: upstream.status });
  }

  const { access, refresh } = data ?? {};
  const res = NextResponse.json({ ok: true });

  const secure = process.env.NODE_ENV === "production";

  res.cookies.set("access_token", access, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
    maxAge: 60 * 60,
  });

  res.cookies.set("refresh_token", refresh, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
    maxAge: 7 * 24 * 60 * 60,
  });

  return res;
}
