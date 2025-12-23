import { NextResponse } from "next/server";

type Goshuin = {
  id: number;
  title?: string | null;
  image_url?: string | null;
  shrine_name?: string | null;
  is_public: boolean;
};

export async function GET(req: Request, { params }: { params: { username: string } }) {
  const base = (process.env.DJANGO_API_BASE_URL ?? "").replace(/\/$/, "");
  if (!base) return NextResponse.json({ error: "DJANGO_API_BASE_URL is not set" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(48, Number(searchParams.get("limit") ?? 12) || 12));
  const offset = Math.max(0, Number(searchParams.get("offset") ?? 0) || 0);

  const url = `${base}/goshuins/?username=${encodeURIComponent(params.username)}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: { "content-type": res.headers.get("content-type") ?? "text/plain" },
      });
    }

    const raw = (await res.json()) as Goshuin[]; // backendは配列
    const sliced = raw.slice(offset, offset + limit);

    return NextResponse.json({
      count: raw.length,
      next: offset + limit < raw.length ? "next" : null,
      previous: offset > 0 ? "prev" : null,
      results: sliced,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "upstream fetch failed", url, message: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
