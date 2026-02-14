// apps/web/src/app/api/places/resolve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

const DEBUG = process.env.NODE_ENV !== "production" && process.env.DEBUG_LOG === "1";

async function safeJsonPassthrough(upstream: Response) {
  const contentType = upstream.headers.get("content-type") ?? "";
  const text = await upstream.text().catch(() => "");

  // JSONじゃないなら遮断（HTML混入対策）
  if (!contentType.includes("application/json")) {
    if (DEBUG) {
      console.warn("[bff/places/resolve] upstream returned non-json", {
        status: upstream.status,
        contentType,
        body_head: text.slice(0, 120),
      });
    }
    return NextResponse.json(
      {
        results: [],
        error: "upstream returned non-json",
        status: upstream.status,
        contentType,
        body_head: text.slice(0, 200),
      },
      { status: 200 }, // UIを殺さない方針
    );
  }

  // upstreamがJSONでも、ステータスがNGならUI側のために握り潰すかは好み
  // ここは「resolveは候補が空でもUIは動ける」ので200で返すのがおすすめ
  if (!upstream.ok) {
    if (DEBUG) {
      console.warn("[bff/places/resolve] upstream not ok", {
        status: upstream.status,
        body_head: text.slice(0, 120),
      });
    }
    return NextResponse.json(
      {
        results: [],
        error: "upstream not ok",
        status: upstream.status,
        body_head: text.slice(0, 200),
      },
      { status: 200 },
    );
  }

  // JSONならそのまま返す
  return new NextResponse(text, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();

  const upstream = await djFetch(`/api/places/resolve/${qs ? `?${qs}` : ""}`, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  return safeJsonPassthrough(upstream);
}
