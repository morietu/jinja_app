// apps/web/src/app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const isSecureCookie =
  process.env.NODE_ENV === "production" && (process.env.NEXT_PUBLIC_APP_ORIGIN || "").startsWith("https");

export async function POST(req: NextRequest) {
  const refresh = req.cookies.get("refresh_token")?.value;
  if (!refresh) {
    return NextResponse.json({ detail: "no refresh token" }, { status: 401 });
  }

  // Django SimpleJWT: /api/auth/jwt/refresh/ { refresh }
  const r = await djFetch(req, "/api/auth/jwt/refresh/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refresh }),
  });

  const txt = await r.text().catch(() => "");
  if (!r.ok) {
    return new NextResponse(txt || "refresh failed", { status: r.status });
  }

  const data = JSON.parse(txt) as { access?: string };
  if (!data.access) {
    return NextResponse.json({ detail: "no access in response" }, { status: 502 });
  }

  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set("access_token", data.access, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
  return res;
}
