// apps/web/src/app/api/public/goshuins/[username]/route.ts
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

function normalizeBase(raw: string) {
  const s = (raw ?? "").trim();
  if (!s) return "";
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

export async function GET(req: Request) {
  const base = normalizeBase(process.env.DJANGO_API_BASE_URL ?? "");
  if (!base) return NextResponse.json({ error: "DJANGO_API_BASE_URL is not set" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(48, Number(searchParams.get("limit") ?? "12") || 12));
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);

  // ✅ upstream 修正（usernameで絞れないなら、いったん全件からslice）
  const upstream = `${base}/api/goshuins/?is_public=true`;

  try {
    const res = await fetch(upstream, { cache: "no-store", headers: { Accept: "application/json" } });
    const contentType = res.headers.get("content-type") ?? "application/json";

    if (!res.ok) {
      const text = await res.text();
      return new NextResponse(text, { status: res.status, headers: { "content-type": contentType } });
    }

    const data = (await res.json()) as unknown;
    const all = Array.isArray(data) ? (data as Goshuin[]) : [];
    const results = all.slice(offset, offset + limit);

    const body: Paginated<Goshuin> = {
      count: all.length,
      previous: offset > 0 ? `/api/public/goshuins?limit=${limit}&offset=${Math.max(0, offset - limit)}` : null,
      next: offset + limit < all.length ? `/api/public/goshuins?limit=${limit}&offset=${offset + limit}` : null,
      results,
    };

    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: "upstream fetch failed", upstream, message: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
