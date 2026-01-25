import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toInt(v: string | null, def: number) {
  const n = v ? Number(v) : def;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

function toOrigin(raw: string, fallback: string) {
  const s = (raw ?? "").trim();
  if (!s) return fallback;
  // /api を末尾に持ってても剥がす（事故の温床なのでここで潰す）
  return s.replace(/\/api\/?$/, "");
}

/**
 * Public Goshuin Feed
 *
 * - 認証不要（AllowAny 前提）
 * - トップページ用の「公共フィード」
 * - 個人の所有権・編集権限は一切扱わない
 *
 * この route は将来：
 * - キャッシュ
 * - レート制限
 * - 課金制御
 * の集約ポイントにする
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(50, toInt(url.searchParams.get("limit"), 12));

    const origin = toOrigin(process.env.DJANGO_API_BASE_URL ?? process.env.API_BASE ?? "", "http://127.0.0.1:8000");

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
