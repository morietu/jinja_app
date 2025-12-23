import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const isSecureCookie =
  process.env.NODE_ENV === "production" && (process.env.NEXT_PUBLIC_APP_ORIGIN || "").startsWith("https");

type Creds = { usernameRaw: string; passwordRaw: string };

async function readCredentialsRaw(req: NextRequest): Promise<Creds> {
  const ct = req.headers.get("content-type") || "";

  try {
    if (ct.includes("application/json")) {
      const j = await req.json();
      return {
        usernameRaw: String(j?.username ?? ""),
        passwordRaw: String(j?.password ?? ""),
      };
    }

    if (ct.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const usp = new URLSearchParams(text);
      return {
        usernameRaw: String(usp.get("username") ?? ""),
        passwordRaw: String(usp.get("password") ?? ""),
      };
    }

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      return {
        usernameRaw: String(form.get("username") ?? ""),
        passwordRaw: String(form.get("password") ?? ""),
      };
    }
  } catch {
    /* noop */
  }

  return { usernameRaw: "", passwordRaw: "" };
}

export async function POST(req: NextRequest) {
  const { usernameRaw, passwordRaw } = await readCredentialsRaw(req);

  // 1) 未入力は 400（従来どおり）
  if (!usernameRaw || !passwordRaw) {
    return new NextResponse("Invalid credentials", { status: 400 });
  }

  // 2) 前後スペース混入は 400 で弾く（ここがA案の本体）
  if (usernameRaw !== usernameRaw.trim() || passwordRaw !== passwordRaw.trim()) {
    return NextResponse.json({ detail: "ユーザー名/パスワードに余計な空白があります" }, { status: 400 });
  }

  // 3) ここから先は「そのまま」backend に渡す（trimしない）
  const username = usernameRaw;
  const password = passwordRaw;
  
  console.log(
    "[login] DJ URL =",
    process.env.API_BASE,
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN,
    process.env.NEXT_PUBLIC_API_BASE_URL,
  );
  console.log("[login] payload username len =", username.length);
  try {
    const r = await djFetch(`/api/auth/jwt/create/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error("[login] upstream status", r.status, "body", txt.slice(0, 200));
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
    return NextResponse.json({ detail: "バックエンドに接続できません" }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, via: "next-route-handler" });
}
