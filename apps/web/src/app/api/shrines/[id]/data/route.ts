import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const upstreamPath = `/api/shrines/${encodeURIComponent(id)}/data/`;
  const upstream = await djFetch(req, upstreamPath, { method: "GET" });

  const body = await upstream.text();
  const contentType = upstream.headers.get("content-type") || "application/json";

  if (!upstream.ok) {
    // ✅ ここはデバッグしやすい形で返すのはアリ
    return NextResponse.json(
      {
        error: "upstream_failed",
        status: upstream.status,
        upstream: upstream.url,
        body: body.slice(0, 1000),
      },
      { status: 502 },
    );
  }

  // ✅ upstream の status / content-type を尊重
  return new NextResponse(body, {
    status: upstream.status,
    headers: { "Content-Type": contentType },
  });
}
