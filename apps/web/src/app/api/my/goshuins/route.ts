// apps/web/src/app/api/my/goshuins/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

async function refreshAccessToken(req: NextRequest): Promise<string | null> {
  const refresh = req.cookies.get("refresh_token")?.value ?? null;
  if (!refresh) return null;

  const r = await djFetch(req, "/api/auth/jwt/refresh/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!r.ok) return null;

  const data = (await r.json()) as { access?: string };
  return data.access ?? null;
}

// GET /api/my/goshuins/ → Django /api/my/goshuins/
export async function GET(req: NextRequest) {
  try {
    const doUpstream = (accessOverride?: string) =>
      djFetch(req, "/api/my/goshuins/", {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(accessOverride ? { Authorization: `Bearer ${accessOverride}` } : {}),
        },
      });

    let upstream = await doUpstream();

    if (upstream.status === 401) {
      const newAccess = await refreshAccessToken(req);
      if (newAccess) upstream = await doUpstream(newAccess);

      const text = await upstream.text();
      const res = new NextResponse(text, {
        status: upstream.status,
        headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
      });

      if (newAccess && upstream.ok) {
        res.cookies.set("access_token", newAccess, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 });
      }
      return res;
    }

    const text = await upstream.text();

    console.log("[BFF] /api/my/goshuins/ upstream status:", upstream.status);
    console.log("[BFF] /api/my/goshuins/ upstream body snippet:", text.slice(0, 200));

    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (err: unknown) {
    console.error("[BFF] /api/my/goshuins/ GET error:", err);
    return NextResponse.json(
      {
        detail: "BFF でエラーが発生しました",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

// POST /api/my/goshuins/ → Django /api/my/goshuins/
export async function POST(req: NextRequest) {
  try {
    const incoming = await req.formData();
    const outgoing = new FormData();
    incoming.forEach((value, key) => outgoing.append(key, value as any));

    const doUpstream = (accessOverride?: string) =>
      djFetch(req, "/api/my/goshuins/", {
        method: "POST",
        body: outgoing,
        headers: {
          Accept: "application/json",
          ...(accessOverride ? { Authorization: `Bearer ${accessOverride}` } : {}),
        },
      });

    let upstream = await doUpstream();

    if (upstream.status === 401) {
      const newAccess = await refreshAccessToken(req);
      if (newAccess) upstream = await doUpstream(newAccess);

      const text = await upstream.text();
      const res = new NextResponse(text, {
        status: upstream.status,
        headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
      });

      if (newAccess && upstream.ok) {
        res.cookies.set("access_token", newAccess, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 });
      }
      return res;
    }

    const text = await upstream.text();

    console.log("[BFF] /api/my/goshuins/ POST upstream status:", upstream.status);
    if (upstream.status === 403) {
      console.warn("[BFF] goshuin limit exceeded?", text.slice(0, 200));
    }

    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (err: unknown) {
    console.error("[BFF] /api/my/goshuins/ POST error:", err);
    return NextResponse.json(
      {
        detail: "BFF でエラーが発生しました",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
