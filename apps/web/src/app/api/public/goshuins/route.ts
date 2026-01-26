// apps/web/src/app/api/public/goshuins/route.ts
import { NextResponse } from "next/server";
import { clampLimit, getDjangoOrigin } from "@/lib/bff/origin";

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
  try {
    const origin = getDjangoOrigin();
    const { searchParams } = new URL(req.url);

    const limit = clampLimit(searchParams.get("limit"), 12, 48);
    const offset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);
    const shrine = Number(searchParams.get("shrine") ?? "") || null;

    if (!shrine) {
      return NextResponse.json({ error: "shrine is required" }, { status: 400 });
    }

    const upstream = `${origin}/api/goshuins/?is_public=true&shrine=${shrine}`;

    const r = await fetch(upstream, { cache: "no-store", headers: { Accept: "application/json" } });

    const contentType = r.headers.get("content-type") ?? "";
    const text = await r.text();

    // ✅ HTML混入を遮断
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "upstream returned non-json", upstream, status: r.status, contentType, body: text.slice(0, 300) },
        { status: 502 },
      );
    }

    if (!r.ok) {
      return NextResponse.json(
        { error: "upstream not ok", upstream, status: r.status, body: text.slice(0, 300) },
        { status: 502 },
      );
    }

    const data = JSON.parse(text) as unknown;
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

    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: "public goshuins route failed", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
