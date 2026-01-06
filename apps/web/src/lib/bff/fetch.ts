// apps/web/src/lib/bff/fetch.ts
import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import type { NextRequest } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export type BffFetchOptions = {
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

// --------------------
// 既存: headers()/cookies() 版
// --------------------
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

  const doFetch = (bearerOverride?: string) =>
    fetch(`${API_BASE}${upstreamPath}`, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
        ...(bearerOverride ? { Authorization: bearerOverride } : bearer ? { Authorization: bearer } : {}),
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
    });

  const upstream = await doFetch();

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

  if (upstream.status === 204) return new NextResponse(null, { status: 204 });

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
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    opts,
  );
}

export async function bffGetWithAuth(upstreamPath: string, opts: BffFetchOptions = {}): Promise<NextResponse> {
  return bffFetchWithAuth(upstreamPath, { method: "GET" }, opts);
}

// --------------------
// 新規: NextRequest を受け取る版（cookie を確実に読む）
// --------------------
export async function bffFetchWithAuthFromReq(
  req: NextRequest,
  upstreamPath: string,
  init: RequestInit = {},
  opts: BffFetchOptions = {},
): Promise<NextResponse> {
  const { retryOn401 = true, setAccessCookie = true } = opts;

  const authHeader = req.headers.get("authorization") ?? undefined;
  const access = req.cookies.get("access_token")?.value;
  const refresh = req.cookies.get("refresh_token")?.value;

  const bearer = authHeader ?? (access ? `Bearer ${access}` : undefined);
  const cookieHeader = req.headers.get("cookie") ?? "";

  const doFetch = (bearerOverride?: string) =>
    fetch(`${API_BASE}${upstreamPath}`, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
        ...(bearerOverride ? { Authorization: bearerOverride } : bearer ? { Authorization: bearer } : {}),
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
    });

  const upstream = await doFetch();

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

  if (upstream.status === 204) return new NextResponse(null, { status: 204 });

  const text = await upstream.text().catch(() => "");
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export async function bffPostJsonWithAuthFromReq(
  req: NextRequest,
  upstreamPath: string,
  payload: unknown,
  opts: BffFetchOptions = {},
): Promise<NextResponse> {
  return bffFetchWithAuthFromReq(
    req,
    upstreamPath,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    opts,
  );
}
