// apps/web/src/lib/server/bff.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function getBackendBaseUrl() {
  // プロジェクトで使ってそうな順に拾う（無ければローカル）
  return (
    process.env.BACKEND_BASE_URL ||
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:8000"
  ).replace(/\/$/, "");
}

/**
 * Next.js Route Handler -> Django(API) へ JSON POST をプロキシする
 * cookie を forward するので auth も素通しできる
 */
export async function bffPostJsonWithAuthFromReq(req: NextRequest, path: string, payload: unknown) {
  const base = getBackendBaseUrl();
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

  // content-type は upstream を尊重（json 以外でも壊さない）
  const ct = upstream.headers.get("content-type") ?? "application/json";

  return new NextResponse(bodyText, {
    status: upstream.status,
    headers: { "content-type": ct },
  });
}
