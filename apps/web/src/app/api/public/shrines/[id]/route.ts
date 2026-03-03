// apps/web/src/app/api/public/shrines/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

// 🔒 public 専用 upstream（private に変えない）
const DJANGO_PUBLIC_BASE = "/api/public/shrines";

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const upstreamPath = `${DJANGO_PUBLIC_BASE}/${encodeURIComponent(id)}/`;
  const upstream = await djFetch(req, upstreamPath, { method: "GET" });

  const contentType = upstream.headers.get("content-type") ?? "";
  const bodyText = await upstream.text();

  if (!upstream.ok) {
    return NextResponse.json(
      {
        error: "upstream_failed",
        status: upstream.status,
        upstream: upstream.url,
        body: bodyText.slice(0, 1000),
      },
      { status: 502 },
    );
  }

  // JSONじゃないなら、そのまま返す（事故防止）
  if (!contentType.includes("application/json")) {
    return new NextResponse(bodyText, {
      status: upstream.status,
      headers: { "Content-Type": contentType || "text/plain" },
    });
  }

  // ✅ JSONだけ normalize
  let raw: any;
  try {
    raw = JSON.parse(bodyText);
  } catch {
    return NextResponse.json(
      { error: "invalid_json", upstream: upstream.url, body: bodyText.slice(0, 400) },
      { status: 502 },
    );
  }

  const latitude = raw?.latitude ?? raw?.lat ?? null;
  const longitude = raw?.longitude ?? raw?.lng ?? null;

  // 「入口固定」なので、返す形も固定していい
  const out = {
    ...raw,
    latitude,
    longitude,
  };

  // 互換を切るならここで落とす（おすすめ）
  delete out.lat;
  delete out.lng;

  return NextResponse.json(out, { status: upstream.status });
}
