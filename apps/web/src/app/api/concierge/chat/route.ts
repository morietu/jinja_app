import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function refreshAccessToken(refresh: string) {
  const res = await fetch(`${API_BASE}/api/auth/jwt/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return (data?.access as string | null) ?? null;
}

// ✅ cookies() が「Promise を返す版」「同期で返す版」両対応
async function getCookieStore() {
  const cs: any = cookies();
  return typeof cs?.then === "function" ? await cs : cs;
}

export async function POST(req: Request) {
  try {
    const cookieStore: any = await getCookieStore();

    const access = cookieStore?.get?.("access_token")?.value;
    const refresh = cookieStore?.get?.("refresh_token")?.value;

    const body = await req.text();

    const doFetch = async (token?: string) =>
      await fetch(`${API_BASE}/api/concierge/chat/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
        cache: "no-store",
      });

    let upstream = await doFetch(access);
    let newAccess: string | null = null;

    if (upstream.status === 401 && refresh) {
      newAccess = await refreshAccessToken(refresh);
      if (newAccess) upstream = await doFetch(newAccess);
    }

    const text = await upstream.text();

    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      return new NextResponse(text || "", {
        status: upstream.status,
        headers: { "Content-Type": upstream.headers.get("content-type") ?? "text/plain; charset=utf-8" },
      });
    }

    const res = NextResponse.json(payload, { status: upstream.status });

    // ✅ cookie更新は response に対して
    if (newAccess) {
      res.cookies.set("access_token", newAccess, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
        secure: false,
      });
    }

    return res;
  } catch (e: any) {
    console.error("[/api/concierge/chat] route error:", e);
    return NextResponse.json(
      { ok: false, detail: String(e?.message ?? e), name: e?.name ?? null, stack: e?.stack ?? null },
      { status: 500 },
    );
  }
}
