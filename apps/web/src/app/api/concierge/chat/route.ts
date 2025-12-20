import { NextResponse } from "next/server";
import { cookies } from "next/headers";

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

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const access = cookieStore.get("access_token")?.value;
  const refresh = cookieStore.get("refresh_token")?.value;
  
  const body = await req.text();

  const doFetch = (token?: string) =>
    fetch(`${API_BASE}/api/concierge/chat/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
      cache: "no-store",
    });

  // 1st try (access)
  let res = await doFetch(access);

  // access expired -> refresh -> retry
  if (res.status === 401 && refresh) {
    const newAccess = await refreshAccessToken(refresh);
    if (newAccess) {
      cookieStore.set("access_token", newAccess, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
        secure: false, // productionは true 判定に合わせる
      });
      res = await doFetch(newAccess);
    }
  }

  const text = await res.text();
  try {
    return NextResponse.json(JSON.parse(text), { status: res.status });
  } catch {
    return new NextResponse(text || "", {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "text/plain; charset=utf-8" },
    });
  }
}
