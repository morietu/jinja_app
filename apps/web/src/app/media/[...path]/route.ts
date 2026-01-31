// apps/web/src/app/media/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function HEAD(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  // GET と同じ処理でOK（bodyは捨てられる）
  return GET(req, ctx);
}


export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  console.log("[media route] HIT", req.nextUrl.pathname);
  const { path } = await ctx.params;

  // パスは一応エスケープ（変な文字や ../ 対策）
  const safe = path.map((p) => encodeURIComponent(p)).join("/");
  const upstreamPath = `/media/${safe}${req.nextUrl.search || ""}`;

  // Range を forward（動画/大きい画像向け）
  const range = req.headers.get("range") ?? undefined;

  const upstream = await djFetch(req, upstreamPath, {
    method: "GET",
    headers: {
      ...(range ? { range } : {}),
    },
  });

  const res = new NextResponse(upstream.body, { status: upstream.status });
  res.headers.set("x-media-route", "1");

  // 重要ヘッダだけ forward（必要なら追加）
  const passHeaders = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "cache-control",
    "etag",
    "last-modified",
  ] as const;

  for (const k of passHeaders) {
    const v = upstream.headers.get(k);
    if (v) res.headers.set(k, v);
  }

  return res;
}
