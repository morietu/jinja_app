// apps/web/src/app/api/public/goshuins/route.ts
import { NextResponse } from "next/server";
import { getDjangoOrigin } from "@/lib/bff/origin";

type Goshuin = {
  id: number;
  shrine?: number;
  title?: string | null;
  image_url?: string | null;
  shrine_name?: string | null;
  is_public: boolean;
  likes?: number;
  created_at?: string;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export async function GET(req: Request) {
  const origin = getDjangoOrigin();
  if (!origin) return NextResponse.json({ error: "DJANGO_API_BASE_URL is not set" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(48, Number(searchParams.get("limit") ?? "12") || 12));
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);
  const shrine = Number(searchParams.get("shrine") ?? "") || null;

  if (!shrine) {
    return NextResponse.json({ error: "shrine is required" }, { status: 400 });
  }

  const upstream = `${origin}/api/goshuins/?is_public=true&shrine=${shrine}`;

  try {
    const res = await fetch(upstream, { cache: "no-store" });
    const contentType = res.headers.get("content-type") ?? "application/json";

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "upstream not ok", upstream, status: res.status, body: text.slice(0, 300) },
        { status: 502 },
      );
    }

    const data = (await res.json()) as unknown;
    const allRaw = Array.isArray(data) ? (data as Goshuin[]) : [];
    const results = allRaw.slice(offset, offset + limit);

    const body: Paginated<Goshuin> = {
      count: allRaw.length,
      previous:
        offset > 0
          ? `/api/public/goshuins?limit=${limit}&offset=${Math.max(0, offset - limit)}&shrine=${shrine}`
          : null,
      next:
        offset + limit < allRaw.length
          ? `/api/public/goshuins?limit=${limit}&offset=${offset + limit}&shrine=${shrine}`
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
