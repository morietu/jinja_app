// apps/web/src/lib/server/bff.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDjangoOrigin } from "@/lib/server/backend"; // ← server-only のやつ

function backendBase() {
  return getDjangoOrigin().replace(/\/$/, "");
}

export async function bffPostJsonWithAuthFromReq(req: NextRequest, path: string, payload: unknown) {
  const base = backendBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const cookie = req.headers.get("cookie") ?? "";
  const authorization = req.headers.get("authorization") ?? "";

  const upstream = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(cookie ? { cookie } : {}),
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify(payload ?? {}),
  });

  const bodyText = await upstream.text();
  const ct = upstream.headers.get("content-type") ?? "application/json";

  return new NextResponse(bodyText, { status: upstream.status, headers: { "content-type": ct } });
}
