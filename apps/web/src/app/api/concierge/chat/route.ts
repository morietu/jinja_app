// apps/web/src/app/api/concierge/chat/route.ts;
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RefreshResponse = { access?: string; refresh?: string };

function buildProxyResponse(upstream: Response, body: string) {
  const ct = upstream.headers.get("content-type") ?? "text/plain; charset=utf-8";
  const res = new NextResponse(body, {
    status: upstream.status,
    headers: { "content-type": ct },
  });

  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) {
    res.headers.append("set-cookie", setCookie);
  }

  return res;
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const contentType = req.headers.get("content-type") ?? "application/json";
  const refreshToken = req.cookies.get("refresh_token")?.value ?? null;

  const doChat = (accessToken: string | null) =>
    djFetch(req, "/api/concierge/chat/", {
      method: "POST",
      headers: {
        "content-type": contentType,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: payload,
    });

  let accessToken = req.cookies.get("access_token")?.value ?? null;
  let upstream = await doChat(accessToken);

  if (upstream.status === 401 && refreshToken) {
    const refreshUpstream = await djFetch(req, "/api/auth/jwt/refresh/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (refreshUpstream.ok) {
      const json = (await refreshUpstream.json()) as RefreshResponse;
      const nextAccess = json.access ?? null;

      if (nextAccess) {
        accessToken = nextAccess;
        upstream = await doChat(accessToken);

        const body = await upstream.text();
        const res = buildProxyResponse(upstream, body);

        res.cookies.set("access_token", nextAccess, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60,
        });

        if (json.refresh) {
          res.cookies.set("refresh_token", json.refresh, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
          });
        }

        return res;
      }
    }

    const body = await upstream.text();
    const res = buildProxyResponse(upstream, body);
    res.cookies.delete("access_token");
    return res;
  }

  const body = await upstream.text();
  return buildProxyResponse(upstream, body);
}
