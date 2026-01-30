import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

function rewritePageLink(v: unknown, req: NextRequest): string | null {
  if (typeof v !== "string" || v.length === 0) return null;

  try {
    const u = new URL(v, req.nextUrl.origin);

    // ✅ populars 以外は触らない（事故防止）
    if (!u.pathname.includes("/api/populars/")) return v;

    // ✅ クエリだけ抜き出して、BFF の /api/populars/ に寄せる
    return `${req.nextUrl.origin}/api/populars/${u.search}`;
  } catch {
    // 壊れたURLは握りつぶさず、そのまま返す方がデバッグしやすい
    return typeof v === "string" ? v : null;
  }
}

export async function GET(req: NextRequest) {
  const upstreamPath = `/api/populars/${req.nextUrl.search || ""}`;
  const upstream = await djFetch(req, upstreamPath, { method: "GET" });

  if (!upstream.ok) {
    const text = await upstream.text();
    return NextResponse.json(
      {
        error: "upstream_failed",
        status: upstream.status,
        upstream: upstream.url,
        body: text.slice(0, 1000),
      },
      { status: 502 },
    );
  }

  // ✅ JSONとして取得（パースも型も素直）
  let data: any;
  try {
    data = await upstream.json();
  } catch {
    return NextResponse.json({ error: "bad_upstream_json" }, { status: 502 });
  }

  if (data && typeof data === "object") {
    data.next = rewritePageLink(data.next, req);
    data.previous = rewritePageLink(data.previous, req);
  }

  return NextResponse.json(data);
}
