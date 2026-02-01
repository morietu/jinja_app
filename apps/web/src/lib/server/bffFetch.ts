// apps/web/src/lib/server/bffFetch.ts
import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDjangoOrigin } from "@/lib/server/backend";



type Init = RequestInit;

export type BffFetchOptions = {
  retryOn401?: boolean; // default true
  setAccessCookie?: boolean; // default true
};

function apiBase() {
  return getDjangoOrigin().replace(/\/$/, "");
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessViaBackendMutex(refresh: string): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = refreshAccessViaBackend(refresh).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function refreshAccessViaBackend(refresh: string): Promise<string | null> {
  const r = await fetch(`${apiBase()}/api/auth/jwt/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refresh }),
    cache: "no-store",
  });
  if (!r.ok) return null;

  const data = (await r.json().catch(() => null)) as any;
  return typeof data?.access === "string" ? data.access : null;
}

function readJwtExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const payload = parts[1];
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const b64p = b64 + pad;

    const bin = typeof atob === "function" ? atob(b64p) : null;
    if (bin == null) return null;

    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);

    const obj = JSON.parse(json) as any;
    return typeof obj?.exp === "number" ? obj.exp : null;
  } catch {
    return null;
  }
}

export async function bffFetchWithAuthFromReq(
  req: NextRequest,
  upstreamPath: string,
  init: Init = {},
  opts: BffFetchOptions = {},
): Promise<NextResponse> {
  const { retryOn401 = true, setAccessCookie = true } = opts;

  const headerAuth = req.headers.get("authorization") ?? null;
  const access = req.cookies.get("access_token")?.value ?? null;
  const refresh = req.cookies.get("refresh_token")?.value ?? null;

  let preRefreshedAccess: string | null = null;

  const nowSec = Math.floor(Date.now() / 1000);
  const exp = access ? readJwtExp(access) : null;
  const skewSec = 20;

  const shouldPreRefresh =
    retryOn401 && refresh && !headerAuth && (!access || (exp != null && exp <= nowSec + skewSec));

  if (shouldPreRefresh) {
    preRefreshedAccess = await refreshAccessViaBackendMutex(refresh);
  }

  const buildAuth = (override?: string | null) => {
    if (headerAuth) return headerAuth;
    if (override) return `Bearer ${override}`;
    if (preRefreshedAccess) return `Bearer ${preRefreshedAccess}`;
    if (access) return `Bearer ${access}`;
    return null;
  };

  const doFetch = (overrideAccess?: string | null) => {
    const auth = buildAuth(overrideAccess);
    const cookieHeader = req.headers.get("cookie");

    return fetch(`${apiBase()}${upstreamPath}`, {
      ...init,
      cache: "no-store",
      headers: {
        ...(init.headers ?? {}),
        ...(auth ? { Authorization: auth } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });
  };

  let upstream = await doFetch(preRefreshedAccess);

  let newAccess: string | null = null;
  if ((upstream.status === 401 || upstream.status === 403) && retryOn401 && refresh) {
    newAccess = await refreshAccessViaBackendMutex(refresh);
    if (newAccess) upstream = await doFetch(newAccess);
  }

  const text = upstream.status === 204 ? "" : await upstream.text().catch(() => "");
  const res =
    upstream.status === 204
      ? new NextResponse(null, { status: 204 })
      : new NextResponse(text, {
          status: upstream.status,
          headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
        });

  const tokenToSet = newAccess ?? preRefreshedAccess;
  if (tokenToSet && setAccessCookie) {
    res.cookies.set("access_token", tokenToSet, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60,
    });
  }

  return res;
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
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    },
    opts,
  );
}
