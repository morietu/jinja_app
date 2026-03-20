// apps/web/src/app/api/concierge/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RefreshResponse = { access?: string; refresh?: string };

function logChatDebug(payload: string, upstreamBodyText: string) {
  let upstreamJson: any = null;

  try {
    upstreamJson = JSON.parse(upstreamBodyText);
  } catch {
    upstreamJson = null;
  }

  console.log("API_CHAT_REQUEST_BODY", payload);
  console.log("API_CHAT_UPSTREAM_TEXT", upstreamBodyText);
  console.log("API_CHAT_UPSTREAM_JSON", upstreamJson);

  console.log(
    "API_CHAT_UPSTREAM_RECS",
    (upstreamJson?.data?.recommendations ?? []).map((r: any) => ({
      name: r?.display_name ?? r?.name,
      scoreElement: r?.breakdown?.score_element ?? null,
      recAstro: r?._signals?.astro ?? r?._astro ?? null,
      keys: Object.keys(r ?? {}),
    })),
  );

  console.log("API_CHAT_UPSTREAM_ROOT_SIGNALS", upstreamJson?.data?._signals ?? null);
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
      const refreshJson = (await refreshUpstream.json()) as RefreshResponse;
      const nextAccess = refreshJson.access ?? null;

      if (nextAccess) {
        accessToken = nextAccess;
        upstream = await doChat(accessToken);

        const upstreamBodyText = await upstream.text();
        const ct = upstream.headers.get("content-type") ?? "text/plain; charset=utf-8";

        logChatDebug(payload, upstreamBodyText);

        const res = new NextResponse(upstreamBodyText, {
          status: upstream.status,
          headers: { "content-type": ct },
        });

        res.cookies.set("access_token", nextAccess, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60,
        });

        if (refreshJson.refresh) {
          res.cookies.set("refresh_token", refreshJson.refresh, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
          });
        }

        return res;
      }
    }

    const upstreamBodyText = await upstream.text();
    const ct = upstream.headers.get("content-type") ?? "text/plain; charset=utf-8";
    const res = new NextResponse(upstreamBodyText, {
      status: upstream.status,
      headers: { "content-type": ct },
    });
    res.cookies.delete("access_token");
    return res;
  }

  const upstreamBodyText = await upstream.text();
  const ct = upstream.headers.get("content-type") ?? "text/plain; charset=utf-8";

  logChatDebug(payload, upstreamBodyText);

  return new NextResponse(upstreamBodyText, {
    status: upstream.status,
    headers: { "content-type": ct },
  });
}
