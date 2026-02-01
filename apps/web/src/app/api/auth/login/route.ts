import { NextRequest, NextResponse } from "next/server";
import { serverLog, getRequestId } from "@/lib/server/logging";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEBUG = process.env.AUTH_DEBUG === "1";

function isSecureCookie(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") return false;

  const xfProto = req.headers.get("x-forwarded-proto");
  const proto = (xfProto ? xfProto.split(",")[0].trim() : req.nextUrl.protocol.replace(":", "")).toLowerCase();

  return proto === "https";
}

type Creds = { usernameRaw: string; passwordRaw: string };

async function readCredentialsRaw(req: NextRequest): Promise<Creds> {
  const ct = req.headers.get("content-type") || "";

  try {
    if (ct.includes("application/json")) {
      const j = await req.json();
      return { usernameRaw: String(j?.username ?? ""), passwordRaw: String(j?.password ?? "") };
    }
    if (ct.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const usp = new URLSearchParams(text);
      return { usernameRaw: String(usp.get("username") ?? ""), passwordRaw: String(usp.get("password") ?? "") };
    }
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      return { usernameRaw: String(form.get("username") ?? ""), passwordRaw: String(form.get("password") ?? "") };
    }
  } catch {
    /* noop */
  }
  return { usernameRaw: "", passwordRaw: "" };
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  const { usernameRaw, passwordRaw } = await readCredentialsRaw(req);

  if (!usernameRaw || !passwordRaw) {
    return NextResponse.json({ detail: "Invalid credentials" }, { status: 400 });
  }
  if (usernameRaw !== usernameRaw.trim() || passwordRaw !== passwordRaw.trim()) {
    return NextResponse.json({ detail: "ユーザー名/パスワードに余計な空白があります" }, { status: 400 });
  }

  const username = usernameRaw;
  const password = passwordRaw;

  if (DEBUG) serverLog("debug", "AUTH_LOGIN_ATTEMPT", { requestId, usernameLen: username.length });

  try {
    const upstreamPath = "/api/auth/jwt/create/";

    // ✅ login は req を渡さない（既存 cookie / Authorization を upstream に混ぜない）
    const r = await djFetch(upstreamPath, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const contentType = r.headers.get("content-type") || "";
    const bodyText = await r.text();

    if (!r.ok) {
      serverLog("warn", "AUTH_LOGIN_UPSTREAM_NOT_OK", {
        requestId,
        status: r.status,
        upstreamPath,
        contentType,
        bodyPreview: bodyText.slice(0, 300),
      });

      return NextResponse.json(
        { detail: "Login failed", upstreamStatus: r.status, upstreamBody: bodyText.slice(0, 1000) },
        { status: r.status },
      );
    }

    let data: { access: string; refresh: string };
    try {
      data = JSON.parse(bodyText) as { access: string; refresh: string };
    } catch {
      serverLog("error", "AUTH_LOGIN_UPSTREAM_BAD_JSON", {
        requestId,
        upstreamPath,
        contentType,
        bodyPreview: bodyText.slice(0, 300),
      });
      return NextResponse.json({ detail: "upstream returned bad json" }, { status: 502 });
    }

    const { access, refresh } = data;

    const secure = isSecureCookie(req); // ✅ boolean に評価

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set("access_token", access, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60,
    });
    res.cookies.set("refresh_token", refresh, {
      httpOnly: true,
      secure,
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
