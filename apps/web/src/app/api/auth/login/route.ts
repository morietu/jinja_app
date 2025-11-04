import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const isSecureCookie =
  process.env.NODE_ENV === "production" &&
  (process.env.NEXT_PUBLIC_APP_ORIGIN || "").startsWith("https");

async function readCredentials(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const j = await req.json();
      return {
        username: String(j?.username || ""),
        password: String(j?.password || ""),
      };
    }
    if (ct.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const usp = new URLSearchParams(text);
      return {
        username: String(usp.get("username") || ""),
        password: String(usp.get("password") || ""),
      };
    }
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      return {
        username: String(form.get("username") || ""),
        password: String(form.get("password") || ""),
      };
    }
  } catch {
    /* noop */
  }
  return { username: "", password: "" };
}

export async function POST(req: NextRequest) {
  const { username, password } = await readCredentials(req);
  if (!username || !password) {
    return new NextResponse("Invalid credentials", { status: 400 });
  }

  try {
    const r = await djFetch(`/api/auth/jwt/create/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return new NextResponse(txt || "Login failed", { status: r.status });
    }
    const { access, refresh } = await r.json();

    const res = NextResponse.json({ ok: true }, { status: 200 });
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
  } catch {
    return NextResponse.json(
      { detail: "バックエンドに接続できません" },
      { status: 503 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, via: "next-route-handler" });
}
