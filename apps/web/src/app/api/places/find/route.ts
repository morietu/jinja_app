import { NextResponse } from "next/server";
import { serverLog, getRequestId } from "@/lib/server/logging";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const DEBUG = process.env.NODE_ENV !== "production" && process.env.DEBUG_LOG === "1";

async function forwardToUpstream(body: unknown, req?: Request) {
  const requestId = req ? getRequestId(req) : null;

  const upstream = await fetch(`${API_BASE}/api/places/find/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await upstream.text();

  if (DEBUG) {
    serverLog("debug", "BFF_PLACES_FIND_UPSTREAM", {
      requestId,
      status: upstream.status,
      textLen: text.length,
      contentType: upstream.headers.get("content-type") ?? null,
    });
  }

  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

// ✅ GETでも叩けるようにする（seed用）
export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    const { searchParams } = new URL(req.url);
    const input = (searchParams.get("input") ?? "").trim();
    if (!input) {
      return NextResponse.json({ error: "input is required" }, { status: 400 });
    }

    const body = {
      input,
      language: searchParams.get("language") ?? undefined,
      region: searchParams.get("region") ?? undefined,
    };

    return await forwardToUpstream(body, req);
  } catch (e) {
    serverLog("error", "BFF_PLACES_FIND_GET_FAILED", {
      requestId,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "places/find GET failed" }, { status: 500 });
  }
}

// 既存：POST（本命）
export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const body = await req.json();

    if (DEBUG) {
      // bodyの中身は出さない。せいぜい「存在」「キー数」「input長」程度。
      const keys = body && typeof body === "object" ? Object.keys(body as any).length : 0;
      const inputLen =
        body && typeof body === "object" && typeof (body as any).input === "string" ? (body as any).input.length : null;

      serverLog("debug", "BFF_PLACES_FIND_POST", { requestId, keys, inputLen });
    }

    return await forwardToUpstream(body, req);
  } catch (e) {
    serverLog("error", "BFF_PLACES_FIND_POST_FAILED", {
      requestId,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "places/find POST failed" }, { status: 500 });
  }
}
