// apps/web/src/app/api/concierge-threads/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function refreshAccess(req: NextRequest): Promise<string | null> {
  const refresh = req.cookies.get("refresh_token")?.value;
  if (!refresh) return null;

  const r = await djFetch(req, `/api/auth/jwt/refresh/`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!r.ok) return null;

  const data = (await r.json().catch(() => null)) as any;
  return typeof data?.access === "string" ? data.access : null;
}

export async function GET(req: NextRequest) {
  const access = req.cookies.get("access_token")?.value;
  const authHeader = req.headers.get("authorization") ?? (access ? `Bearer ${access}` : null);

  const doFetch = (token?: string) =>
    djFetch(req, "/api/concierge-threads/", {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : authHeader ? { Authorization: authHeader } : {}),
      },
    });

  let r = await doFetch();

  if (r.status === 401) {
    const nextAccess = await refreshAccess(req);
    if (nextAccess) {
      r = await doFetch(nextAccess);
      const text2 = await r.text();
      const res2 = new NextResponse(text2, {
        status: r.status,
        headers: { "Content-Type": r.headers.get("content-type") ?? "application/json" },
      });
      res2.cookies.set("access_token", nextAccess, { httpOnly: true, sameSite: "lax", path: "/" });
      return res2;
    }
  }

  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "Content-Type": r.headers.get("content-type") ?? "application/json" },
  });
}
