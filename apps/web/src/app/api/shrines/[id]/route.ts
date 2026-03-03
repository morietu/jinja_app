// TODO: 互換ルート。2026-04-01 までにアクセス0なら削除
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

// 互換: public固定
const DJANGO_PUBLIC_BASE = "/api/public/shrines";

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const upstream = await djFetch(req, `${DJANGO_PUBLIC_BASE}/${encodeURIComponent(id)}/`, { method: "GET" });

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  const bodyText = await upstream.text();

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "upstream_failed", status: upstream.status, upstream: upstream.url, body: bodyText.slice(0, 1000) },
      { status: 502 },
    );
  }

  return new NextResponse(bodyText, { status: upstream.status, headers: { "Content-Type": contentType } });
}
