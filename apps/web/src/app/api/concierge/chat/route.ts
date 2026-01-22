// apps/web/src/app/api/concierge/chat/route.ts
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

export async function POST(req: NextRequest) {
  let payload: any = null;
  try {
    payload = await req.json();
    console.log("[api/concierge/chat] payload=", payload);
    console.log("[api/concierge/chat] payload.filters.birthdate=", payload?.filters?.birthdate);
    console.log("[api/concierge/chat] payload.birthdate=", payload?.birthdate);
  } catch {}

  // 1st try
  const accessCookie = req.cookies.get("access_token")?.value;
  const headerAuth = req.headers.get("authorization");

  console.log("[api/concierge/chat] hasCookieAccess=", !!req.cookies.get("access_token")?.value);
  console.log("[api/concierge/chat] hasAuthHeader=", !!req.headers.get("authorization"));


  const auth1 = headerAuth ?? (accessCookie ? `Bearer ${accessCookie}` : null);

  const r1 = await djFetch(req, `/api/concierge/chat/`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(auth1 ? { Authorization: auth1 } : {}),
    },
    body: JSON.stringify(payload ?? {}),
  });

  // 401 → refresh → retry
  if (r1.status === 401) {
    const nextAccess = await refreshAccess(req);
    if (nextAccess) {
      const r2 = await djFetch(req, `/api/concierge/chat/`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${nextAccess}`,
        },
        body: JSON.stringify(payload ?? {}),
      });

      const text2 = await r2.text();
      let body2: any;
      try {
        body2 = JSON.parse(text2);
      } catch {
        body2 = { raw: text2 };
      }

      const res = new NextResponse(JSON.stringify(body2), {
        status: r2.status,
        headers: { "Content-Type": "application/json" },
      });

      // ✅ access_token cookie を更新（ここが超重要）
      res.cookies.set("access_token", nextAccess, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      return res;
    }
  }

  const text1 = await r1.text();
  let body1: any;
  try {
    body1 = JSON.parse(text1);
  } catch {
    body1 = { raw: text1 };
  }

  return new NextResponse(JSON.stringify(body1), {
    status: r1.status,
    headers: { "Content-Type": "application/json" },
  });
}
