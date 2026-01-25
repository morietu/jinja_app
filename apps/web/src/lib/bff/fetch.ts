// apps/web/src/lib/bff/fetch.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type Init = RequestInit;

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

  const data = (await r.json().catch(() => null)) as any;
  return typeof data?.access === "string" ? data.access : null;
}

export async function bffFetchWithAuthFromReq(
  req: NextRequest,
  upstreamPath: string,
  init: Init = {},
  opts: BffFetchOptions = {},
): Promise<NextResponse> {
  const { retryOn401 = true, setAccessCookie = true } = opts;

  // 1) Authorization が来てたら優先
  const headerAuth = req.headers.get("authorization") ?? null;

  // 2) なければ cookie の access_token から Bearer を作る
  const access = req.cookies.get("access_token")?.value ?? null;
  const refresh = req.cookies.get("refresh_token")?.value ?? null;

  const buildAuth = (override?: string | null) => {
    if (headerAuth) return headerAuth;
    if (override) return `Bearer ${override}`;
    if (access) return `Bearer ${access}`;
    return null;
  };

    const doFetch = (overrideAccess?: string | null) => {
      const auth = buildAuth(overrideAccess);
      const cookieHeader = req.headers.get("cookie");


      return fetch(`${API_BASE}${upstreamPath}`, {
        ...init,
        cache: "no-store",
        headers: {
          ...(init.headers ?? {}),
          ...(auth ? { Authorization: auth } : {}),
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
      });
    };

  let upstream = await doFetch(null);

  // 3) 401 なら refresh_token で refresh → retry
  let newAccess: string | null = null;
  if (upstream.status === 401 && retryOn401 && refresh) {
    newAccess = await refreshAccessViaBackend(refresh);
    if (newAccess) {
      upstream = await doFetch(newAccess);
    }
  }

  // 5) body / content-type を素直にパススルー
  const text = upstream.status === 204 ? "" : await upstream.text().catch(() => "");
  const res =
    upstream.status === 204
      ? new NextResponse(null, { status: 204 })
      : new NextResponse(text, {
          status: upstream.status,
          headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
        });

  // 4) refresh 成功したら access_token cookie を更新
  if (newAccess && setAccessCookie) {
    res.cookies.set("access_token", newAccess, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60,
      // secure: true, // 本番HTTPSなら有効化
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
      body: JSON.stringify(payload),
    },
    opts,
  );
}
