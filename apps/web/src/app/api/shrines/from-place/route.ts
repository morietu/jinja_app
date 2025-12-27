import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

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

export async function POST(req: Request) {
  const h = await headers();
  const c = await cookies();

  const authHeader = h.get("authorization");
  const access = c.get("access_token")?.value;
  const refresh = c.get("refresh_token")?.value;

  const auth = authHeader ?? (access ? `Bearer ${access}` : undefined);


  console.log("[bff/from-place]", "auth header?", Boolean(authHeader), "cookie access?", Boolean(access));
  console.log(
    "[bff/from-place] access?",
    Boolean(c.get("access_token")?.value),
    "refresh?",
    Boolean(c.get("refresh_token")?.value),
  );

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // 1st try
  const upstream = await fetch(`${API_BASE}/api/shrines/from-place/`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(auth ? { Authorization: auth } : {}),
      ...(h.get("cookie") ? { cookie: h.get("cookie") as string } : {}),
    },
    body: JSON.stringify(payload),
  });

  // 401なら refresh→retry
  if (upstream.status === 401 && refresh) {
    const newAccess = await refreshAccessViaBackend(refresh);
    if (newAccess) {
      const retry = await fetch(`${API_BASE}/api/shrines/from-place/`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${newAccess}`,
        },
        body: JSON.stringify(payload),
      });

      const retryText = await retry.text().catch(() => "");
      const res = new NextResponse(retryText, {
        status: retry.status,
        headers: { "Content-Type": retry.headers.get("content-type") ?? "application/json" },
      });
      res.cookies.set("access_token", newAccess, { path: "/" });
      return res;
    }
  }

  const text = await upstream.text().catch(() => "");
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
