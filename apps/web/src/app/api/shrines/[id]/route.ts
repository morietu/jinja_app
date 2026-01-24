import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const upstreamPath = `/api/shrines/${encodeURIComponent(id)}/data/`;
  const upstream = await djFetch(req, upstreamPath, { method: "GET" });

  const text = await upstream.text();

  if (!upstream.ok) {
    return NextResponse.json(
      {
        error: "upstream_failed",
        status: upstream.status,
        upstream: upstream.url,
        body: text.slice(0, 1000),
      },
      { status: 502 },
    );
  }

  return new NextResponse(text, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
