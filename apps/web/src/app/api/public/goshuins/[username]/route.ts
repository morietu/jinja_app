import { NextResponse } from "next/server";

type Goshuin = {
  id: number;
  title?: string | null;
  image_url?: string | null;
  shrine_name?: string | null;
  is_public: boolean;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export async function GET(req: Request, { params }: { params: { username: string } }) {
  const base = (process.env.DJANGO_API_BASE_URL ?? "").replace(/\/$/, "");
  if (!base) {
    return NextResponse.json({ error: "DJANGO_API_BASE_URL is not set" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(48, Number(searchParams.get("limit") ?? "12") || 12));
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);

  // backend は「公開一覧 = /api/goshuins/」で返している（現状 pagination なしで配列）
  const upstreamUrl = `${base}/goshuins/?username=${encodeURIComponent(params.username)}`;

  try {
    const res = await fetch(upstreamUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      // upstream のエラーはそのまま返す（デバッグしやすく）
      const text = await res.text();
      return new NextResponse(text || JSON.stringify({ error: "upstream error" }), {
        status: res.status,
        headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
      });
    }

    const raw = (await res.json()) as unknown;

    // upstream が配列じゃない場合でも落ちないようにする
    const all = Array.isArray(raw) ? (raw as Goshuin[]) : [];
    const count = all.length;
    const results = all.slice(offset, offset + limit);

    // next/previous は「この API 自身」へのリンクでOK
    const origin = new URL(req.url).origin;
    const path = `/api/public/goshuins/${encodeURIComponent(params.username)}`;

    const previous = offset > 0 ? `${origin}${path}?limit=${limit}&offset=${Math.max(0, offset - limit)}` : null;

    const next = offset + limit < count ? `${origin}${path}?limit=${limit}&offset=${offset + limit}` : null;

    const payload: Paginated<Goshuin> = { count, next, previous, results };
    return NextResponse.json(payload, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: "upstream fetch failed", upstreamUrl, message: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
