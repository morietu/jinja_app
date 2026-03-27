import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RefreshResponse = { access?: string; refresh?: string };

function getUpstreamSetCookies(upstream: Response): string[] {
  const headersAny = upstream.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersAny.getSetCookie === "function") {
    return headersAny.getSetCookie().filter(Boolean);
  }

  const single = upstream.headers.get("set-cookie");
  return single ? [single] : [];
}

function buildProxyResponse(upstream: Response, body: string) {
  const ct = upstream.headers.get("content-type") ?? "text/plain; charset=utf-8";
  const upstreamSetCookies = getUpstreamSetCookies(upstream);

  console.log("[BFF_CHAT_PROXY]", {
    status: upstream.status,
    contentType: ct,
    setCookieCount: upstreamSetCookies.length,
    setCookies: upstreamSetCookies,
  });

  const res = new NextResponse(body, {
    status: upstream.status,
    headers: { "content-type": ct },
  });

  for (const value of upstreamSetCookies) {
    res.headers.append("set-cookie", value);
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

  console.log("[BFF_CHAT_ENTRY]", {
    initialStatus: upstream.status,
    hasRefreshToken: Boolean(refreshToken),
    hasAccessToken: Boolean(accessToken),
  });

  if (upstream.status === 401 && refreshToken) {
    console.log("RETURN PATH: entered refresh flow");

    const refreshUpstream = await djFetch(req, "/api/auth/jwt/refresh/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    console.log("[BFF_CHAT_REFRESH]", {
      refreshStatus: refreshUpstream.status,
      refreshOk: refreshUpstream.ok,
    });

    if (refreshUpstream.ok) {
      const json = (await refreshUpstream.json()) as RefreshResponse;
      const nextAccess = json.access ?? null;

      console.log("[BFF_CHAT_REFRESH_JSON]", {
        hasNextAccess: Boolean(nextAccess),
        hasNextRefresh: Boolean(json.refresh),
      });

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

        console.log("RETURN: refresh success");
        return res;
      }

      console.log("RETURN: refresh ok but no access token");
    }

    const body = await upstream.text();
    const res = buildProxyResponse(upstream, body);
    res.cookies.delete("access_token");

    console.log("RETURN: refresh fallback/delete-access");
    return res;
  }

  const body = await upstream.text();
  console.log("RETURN: normal");
  return buildProxyResponse(upstream, body);
}
