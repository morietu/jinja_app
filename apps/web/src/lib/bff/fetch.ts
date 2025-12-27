// apps/web/src/lib/bff/fetch.ts
import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type BffFetchOptions = {
  retryOn401?: boolean; // default true
  setAccessCookie?: boolean; // default true
};

async function refreshAccessViaBackend(refresh: string): Promise<string | null> {
  const r = await fetch(`${API_BASE}/api/auth/jwt/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refresh }),
    cache: "no-store",
  });
  if (!r.ok) return null;
  const data = (await r.json()) as { access?: string };
  return data.access ?? null;
}

/**
 * 任意method対応。401なら refresh→retry→access_token を Set-Cookie して返す。
 * Route Handler からそのまま return できるよう NextResponse を返す。
 */
export async function bffFetchWithAuth(
  upstreamPath: string,
  init: RequestInit = {},
  opts: BffFetchOptions = {},
): Promise<NextResponse> {
  const { retryOn401 = true, setAccessCookie = true } = opts;

  const h = await headers();
  const c = await cookies();

  const authHeader = h.get("authorization") ?? undefined;
  const access = c.get("access_token")?.value;
  const refresh = c.get("refresh_token")?.value;

  const bearer = authHeader ?? (access ? `Bearer ${access}` : undefined);
  const cookieHeader = h.get("cookie") ?? "";

  const doFetch = async (bearerOverride?: string) => {
    return fetch(`${API_BASE}${upstreamPath}`, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
        ...(bearerOverride ? { Authorization: bearerOverride } : bearer ? { Authorization: bearer } : {}),
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
    });
  };

  // 1st try
  const upstream = await doFetch();

  // retry
  if (upstream.status === 401 && retryOn401 && refresh) {
    const newAccess = await refreshAccessViaBackend(refresh);
    if (newAccess) {
      const retry = await doFetch(`Bearer ${newAccess}`);

      if (retry.status === 204) {
        const res = new NextResponse(null, { status: 204 });
        if (setAccessCookie) res.cookies.set("access_token", newAccess, { path: "/" });
        return res;
      }

      const retryText = await retry.text().catch(() => "");
      const res = new NextResponse(retryText, {
        status: retry.status,
        headers: { "Content-Type": retry.headers.get("content-type") ?? "application/json" },
      });

      if (setAccessCookie) res.cookies.set("access_token", newAccess, { path: "/" });
      return res;
    }
  }

  // 204 は本文無しが正しい
  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  // no retry / retry failed
  const text = await upstream.text().catch(() => "");
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export async function bffPostJsonWithAuth(
  upstreamPath: string,
  payload: unknown,
  opts: BffFetchOptions = {},
): Promise<NextResponse> {
  return bffFetchWithAuth(
    upstreamPath,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    opts,
  );
}

export async function bffGetWithAuth(upstreamPath: string, opts: BffFetchOptions = {}): Promise<NextResponse> {
  return bffFetchWithAuth(upstreamPath, { method: "GET" }, opts);
}
