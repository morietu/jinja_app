// apps/web/src/app/api/places/resolve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";
import { serverLog, getRequestId } from "@/lib/server/logging";

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  const payload = await req.text();

  let upstream: Response;
  try {
    upstream = await djFetch(req, "/api/places/resolve/", {
      method: "POST",
      headers: {
        "content-type": req.headers.get("content-type") ?? "application/json",
        accept: "application/json",
      },
      body: payload,
      cache: "no-store",
    });
  } catch (e) {
    serverLog("warn", "BFF_RESOLVE_UPSTREAM_FETCH_FAILED", {
      requestId,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ detail: "upstream_fetch_failed" }, { status: 502 });
  }

  const rawText = await upstream.text().catch(() => "");
  let raw: any = null;
  try {
    raw = rawText ? JSON.parse(rawText) : null;
  } catch {
    raw = null;
  }

  if (!upstream.ok) {
    serverLog("warn", "BFF_RESOLVE_UPSTREAM_BAD", { requestId, status: upstream.status, body: rawText.slice(0, 300) });
    return NextResponse.json(raw ?? { detail: "upstream_error" }, { status: upstream.status });
  }

  const shrine_id = Number(raw?.shrine_id ?? raw?.id ?? null);
  const place_id = String(raw?.place_id ?? "");
  const candidate_id = Number(raw?.candidate_id ?? null);

  if (!Number.isFinite(shrine_id) || shrine_id <= 0 || !place_id) {
    serverLog("warn", "BFF_RESOLVE_BAD_SHAPE", { requestId, rawKeys: raw ? Object.keys(raw) : null });
    return NextResponse.json({ detail: "bad_upstream_shape" }, { status: 502 });
  }

  return NextResponse.json(
    {
      shrine_id,
      id: shrine_id, // 互換
      place_id,
      ...(Number.isFinite(candidate_id) ? { candidate_id } : {}),
    },
    { status: 200 },
  );
}
