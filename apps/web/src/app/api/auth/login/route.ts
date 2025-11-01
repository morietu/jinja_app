// apps/web/src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = 0;


const BACKEND =
  process.env.BACKEND_ORIGIN ||
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN ||
  "http://127.0.0.1:8000";

const isSecureCookie =
  process.env.NODE_ENV === "production" &&
  (process.env.NEXT_PUBLIC_APP_ORIGIN || "").startsWith("https");

export async function GET() {
  return NextResponse.json({ ok: true, via: "next-route-handler" });
}

export async function POST(req: NextRequest) {
  let body: { username: string; password: string };
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const dj = await fetch(`${BACKEND}/api/auth/jwt/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!dj.ok) {
    const errText = await dj.text().catch(() => "");
    return new NextResponse(errText || "Login failed", { status: dj.status });
  }

  const { access, refresh } = (await dj.json()) as {
    access: string;
    refresh: string;
  };

  const res = NextResponse.json({ ok: true });

  // Cookie は「必ず」NextResponse経由に統一
  res.cookies.set("access_token", access, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1h
  });
  res.cookies.set("refresh_token", refresh, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7d
  });

  return res;
}
