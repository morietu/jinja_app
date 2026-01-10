// apps/web/src/app/api/public/goshuins/route.ts
import { NextResponse } from "next/server";

type Goshuin = {
  id: number;
  shrine?: number;
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
  return s.endsWith("/") ? s.slice(0, -1) : s; // ←これをやめる
}

export async function GET(req: Request) {
  const rawBase = process.env.DJANGO_API_BASE_URL ?? "";
  const base = normalizeBase(rawBase);

  if (!base) {
    return NextResponse.json({ error: "DJANGO_API_BASE_URL is not set" }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(48, Number(searchParams.get("limit") ?? "12") || 12));
    const offset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);
    const shrine = Number(searchParams.get("shrine") ?? "") || null;

    // upstream（Django）へ
    const upstream = `${base}/goshuins/?is_public=true`;
    const res = await fetch(upstream, { cache: "no-store" });
    const contentType = res.headers.get("content-type") ?? "application/json";

    if (!res.ok) {
      const text = await res.text();
      // デバッグに upstream も返す（開発中だけ役立つ）
      return NextResponse.json(
        { error: "upstream not ok", upstream, status: res.status, body: text.slice(0, 300) },
        { status: 502 },
      );
    }

    const data = (await res.json()) as unknown;
    const allRaw = Array.isArray(data) ? (data as Goshuin[]) : [];

    const filtered = shrine ? allRaw.filter((g) => g.shrine === shrine) : allRaw;
    const results = filtered.slice(offset, offset + limit);

    const body: Paginated<Goshuin> = {
      count: filtered.length,
      previous:
        offset > 0
          ? `/api/public/goshuins?limit=${limit}&offset=${Math.max(0, offset - limit)}${
              shrine ? `&shrine=${shrine}` : ""
            }`
          : null,
      next:
        offset + limit < filtered.length
          ? `/api/public/goshuins?limit=${limit}&offset=${offset + limit}${shrine ? `&shrine=${shrine}` : ""}`
          : null,
      results,
    };

    return new NextResponse(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": contentType },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "public goshuins route failed", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
