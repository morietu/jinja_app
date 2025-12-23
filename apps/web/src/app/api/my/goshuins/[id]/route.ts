// apps/web/src/app/api/my/goshuins/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

function extractIdFromUrl(req: NextRequest): string | null {
  const url = new URL(req.url);
  const segments = url.pathname.replace(/\/+$/, "").split("/");
  const last = segments[segments.length - 1] ?? "";
  if (!last || last === "undefined") return null;
  return last;
}

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

export async function PATCH(req: NextRequest) {
  const id = extractIdFromUrl(req);
  if (!id) return NextResponse.json({ detail: "id is required" }, { status: 400 });

  const body = await req.text();
  const contentType = req.headers.get("content-type") ?? "application/json";

  const doUpstream = (accessOverride?: string) =>
    djFetch(req, `/api/my/goshuins/${id}/`, {
      method: "PATCH",
      body,
      headers: {
        Accept: "application/json",
        "Content-Type": contentType,
        ...(accessOverride ? { Authorization: `Bearer ${accessOverride}` } : {}),
      },
    });

  let upstream = await doUpstream();

  // access期限切れ → refresh → retry
  if (upstream.status === 401) {
    const newAccess = await refreshAccessToken(req);
    if (newAccess) upstream = await doUpstream(newAccess);

    // ブラウザ側の次リクエストも通るよう cookie 更新（retry が成功した時だけ）
    if (newAccess && upstream.ok) {
      const text = await upstream.text();
      const res = new NextResponse(text, {
        status: upstream.status,
        headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
      });
      res.cookies.set("access_token", newAccess, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 });
      return res;
    }
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}

export async function DELETE(req: NextRequest) {
  const id = extractIdFromUrl(req);
  if (!id) return NextResponse.json({ detail: "id is required" }, { status: 400 });

  const doUpstream = (accessOverride?: string) =>
    djFetch(req, `/api/my/goshuins/${id}/`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...(accessOverride ? { Authorization: `Bearer ${accessOverride}` } : {}),
      },
    });

  let upstream = await doUpstream();

  if (upstream.status === 401) {
    const newAccess = await refreshAccessToken(req);
    if (newAccess) upstream = await doUpstream(newAccess);

    if (newAccess && upstream.status === 204) {
      const res = new NextResponse(null, { status: 204 });
      res.cookies.set("access_token", newAccess, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 });
      return res;
    }
  }

  if (upstream.status === 204) return new NextResponse(null, { status: 204 });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}
