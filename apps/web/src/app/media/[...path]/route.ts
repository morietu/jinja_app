// apps/web/src/app/media/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;

  const upstreamUrl = `${API_BASE}/media/${path.join("/")}${req.nextUrl.search}`;

  // Range を forward（動画/大きい画像向け）
  const range = req.headers.get("range");

  const upstream = await fetch(upstreamUrl, {
    cache: "no-store",
    headers: {
      ...(range ? { range } : {}),
    },
  });

  const res = new NextResponse(upstream.body, { status: upstream.status });

  // 重要ヘッダだけ forward（必要なら追加）
  const passHeaders = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "cache-control",
    "etag",
    "last-modified",
  ];
  for (const k of passHeaders) {
    const v = upstream.headers.get(k);
    if (v) res.headers.set(k, v);
  }

  return res;
}
