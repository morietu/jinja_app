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

async function readCredentials(req: NextRequest): Promise<{ username: string; password: string }> {
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const j = await req.json();
      return { username: String(j?.username || ""), password: String(j?.password || "") };
    }
    if (ct.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const usp = new URLSearchParams(text);
      return { username: String(usp.get("username") || ""), password: String(usp.get("password") || "") };
    }
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      return { username: String(form.get("username") || ""), password: String(form.get("password") || "") };
    }
  } catch {
    // fallthrough
  }
  return { username: "", password: "" };
}

export async function POST(req: NextRequest) {
  const { username, password } = await readCredentials(req);
  if (!username || !password) {
    return new NextResponse("Invalid JSON or missing credentials", { status: 400 });
  }

  const dj = await fetch(`${BACKEND}/api/auth/jwt/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!dj.ok) {
    const txt = await dj.text().catch(() => "");
    return new NextResponse(txt || "Login failed", { status: dj.status });
  }

  const { access, refresh } = (await dj.json()) as { access: string; refresh: string };

  const res = NextResponse.json({ ok: true });
  res.cookies.set("access_token", access, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
  res.cookies.set("refresh_token", refresh, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function GET() {
  return NextResponse.json({ ok: true, via: "next-route-handler" });
}
