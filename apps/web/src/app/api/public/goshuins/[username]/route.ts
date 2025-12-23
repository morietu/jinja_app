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
  if (!base) return NextResponse.json({ error: "DJANGO_API_BASE_URL is not set" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(48, Number(searchParams.get("limit") ?? "12") || 12));
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);

  const upstream = `${base}/goshuins/?username=${encodeURIComponent(params.username)}`;

  try {
    const res = await fetch(upstream, { cache: "no-store" });
    const contentType = res.headers.get("content-type") ?? "application/json";

    // upstream が失敗ならそのまま返す（デバッグしやすい）
    if (!res.ok) {
      const text = await res.text();
      return new NextResponse(text, { status: res.status, headers: { "content-type": contentType } });
    }

    const data = (await res.json()) as unknown;

    // ① upstream が配列だった場合：Paginated に包む
    if (Array.isArray(data)) {
      const all = data as Goshuin[];
      const results = all.slice(offset, offset + limit);

      const hasPrev = offset > 0;
      const hasNext = offset + limit < all.length;

      const mkUrl = (newOffset: number) =>
        `/api/public/goshuins/${encodeURIComponent(params.username)}?limit=${limit}&offset=${newOffset}`;

      const body: Paginated<Goshuin> = {
        count: all.length,
        previous: hasPrev ? mkUrl(Math.max(0, offset - limit)) : null,
        next: hasNext ? mkUrl(offset + limit) : null,
        results,
      };

      return NextResponse.json(body, { status: 200 });
    }

    // ② 既に Paginated 形式ならそのまま返す
    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: "upstream fetch failed", upstream, message: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
