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
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!r.ok) return null;

  const data = await r.json().catch(() => null);
  const nextAccess = data?.access;
  return typeof nextAccess === "string" ? nextAccess : null;
}

export async function GET(req: NextRequest) {
  const accessCookie = req.cookies.get("access_token")?.value;
  const headerAuth = req.headers.get("authorization");
  const auth1 = headerAuth ?? (accessCookie ? `Bearer ${accessCookie}` : null);

  const r1 = await djFetch(req, `/api/goriyaku-tags/`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(auth1 ? { Authorization: auth1 } : {}),
    },
  });

  if (r1.status === 401) {
    const nextAccess = await refreshAccess(req);
    if (nextAccess) {
      const r2 = await djFetch(req, `/api/goriyaku-tags/`, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${nextAccess}` },
      });

      const text2 = await r2.text();
      const res = new NextResponse(text2, { status: r2.status, headers: { "Content-Type": "application/json" } });
      res.cookies.set("access_token", nextAccess, { httpOnly: true, sameSite: "lax", path: "/" });
      return res;
    }
  }

  const text1 = await r1.text();
  return new NextResponse(text1, { status: r1.status, headers: { "Content-Type": "application/json" } });
}
