// apps/web/src/app/api/public/goshuins/feed/route.ts
import { NextResponse } from "next/server";
import { getDjangoOrigin } from "@/lib/bff/origin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toInt(v: string | null, def: number) {
  const n = v ? Number(v) : def;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

/**
 * Public Goshuin Feed
 * - 認証不要（AllowAny 前提）
 * - トップページ用の「公共フィード」
 * - 個人の所有権・編集権限は一切扱わない
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(50, toInt(url.searchParams.get("limit"), 12));

    const origin = getDjangoOrigin();
    const upstream = `${origin}/api/goshuins/?limit=${limit}`;

    const r = await fetch(upstream, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const contentType = r.headers.get("content-type") ?? "application/json";
    const text = await r.text();

    return new NextResponse(text, { status: r.status, headers: { "content-type": contentType } });
  } catch (e) {
    return NextResponse.json(
      { error: "public goshuin feed failed", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
