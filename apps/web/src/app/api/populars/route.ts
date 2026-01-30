import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

function rewritePageLink(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;

  try {
    // upstream は絶対URLを返しがちなので URL としてパース
    // 相対が来ても parse できるように base は適当に噛ませる
    const u = new URL(value, "http://example.local");
    const qs = u.search; // "?limit=...&offset=..." など
    return `/api/populars/${qs}`;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const upstreamPath = `/api/populars/${req.nextUrl.search || ""}`;
  const upstream = await djFetch(req, upstreamPath, { method: "GET" });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
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

  // ✅ JSONとして扱う（文字列→JSON→再JSON で変換漏れが減る）
  let data: any;
  try {
    data = await upstream.json();
  } catch {
    return NextResponse.json({ error: "bad_upstream_json" }, { status: 502 });
  }

  if (data && typeof data === "object") {
    const next = rewritePageLink(data.next);
    const prev = rewritePageLink(data.previous);

    // 方針：変換できないものは null に倒す（BFF境界の外は見せない）
    if ("next" in data) data.next = next;
    if ("previous" in data) data.previous = prev;
  }

  return NextResponse.json(data);
}
