import { NextResponse } from "next/server";
import { clampLimit, getDjangoOrigin } from "@/lib/bff/origin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = clampLimit(url.searchParams.get("limit"), 12, 50);

    const origin = getDjangoOrigin();
    const upstream = `${origin}/api/goshuins/feed/?limit=${limit}`;

    const r = await fetch(upstream, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    // ✅ HTML混入をここで遮断（仕様固定の保険）
    const contentType = r.headers.get("content-type") ?? "";
    const text = await r.text();

    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "upstream returned non-json", upstream, status: r.status, contentType },
        { status: 502 },
      );
    }

    if (!r.ok) {
      return NextResponse.json(
        { error: "upstream not ok", upstream, status: r.status, body: text.slice(0, 300) },
        { status: 502 },
      );
    }

    return new NextResponse(text, { status: 200, headers: { "content-type": "application/json" } });
  } catch (e) {
    return NextResponse.json(
      { error: "public goshuin feed failed", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
