import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";
import { serverLog, getRequestId } from "@/lib/server/logging";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEBUG = process.env.NODE_ENV !== "production" && process.env.DEBUG_LOG === "1";

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
  const requestId = getRequestId(req);

  const { usernameRaw, passwordRaw } = await readCredentialsRaw(req);

  // 1) 未入力は 400（従来どおり）
  if (!usernameRaw || !passwordRaw) {
    return new NextResponse("Invalid credentials", { status: 400 });
  }

  // 2) 前後スペース混入は 400
  if (usernameRaw !== usernameRaw.trim() || passwordRaw !== passwordRaw.trim()) {
    return NextResponse.json({ detail: "ユーザー名/パスワードに余計な空白があります" }, { status: 400 });
  }

  // 3) ここから先は「そのまま」backend に渡す（trimしない）
  const username = usernameRaw;
  const password = passwordRaw;

  if (DEBUG) {
    serverLog("debug", "AUTH_LOGIN_ATTEMPT", { requestId, usernameLen: username.length });
  }

  try {
    const r = await djFetch(`/api/auth/jwt/create/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      serverLog("warn", "AUTH_LOGIN_UPSTREAM_NOT_OK", {
        requestId,
        status: r.status,
        textLen: txt.length,
      });
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
  } catch (e) {
    serverLog("error", "AUTH_LOGIN_ROUTE_FAILED", {
      requestId,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ detail: "バックエンドに接続できません" }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, via: "next-route-handler" });
}
