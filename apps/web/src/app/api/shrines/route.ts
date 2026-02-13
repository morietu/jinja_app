// apps/web/src/app/api/shrines/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

function buildUpstreamPath(req: NextRequest, basePath: string) {
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Upstream response を「なるべく壊さず」返す。
 * - content-type だけ手動セットだと Set-Cookie / Cache-Control 等を落としがちなので
 *   必要なものを拾って返す
 */
async function passthrough(upstream: Response) {
  const body = await upstream.arrayBuffer(); // JSONでもOK、将来バイナリでも壊れない
  const res = new NextResponse(body, { status: upstream.status });

  // hop-by-hop header は基本除外（proxyの基本）
  const hopByHop = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
  ]);

  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (hopByHop.has(k)) return;

    // set-cookie は複数あり得るので append
    if (k === "set-cookie") {
      res.headers.append("set-cookie", value);
      return;
    }

    res.headers.set(key, value);
  });

  // 万が一 upstream が content-type を返さないケースの保険
  if (!res.headers.get("content-type")) {
    res.headers.set("content-type", "application/json");
  }

  return res;
}

export async function GET(req: NextRequest) {
  const upstreamPath = buildUpstreamPath(req, "/api/shrines/");
  const upstream = await djFetch(req, upstreamPath, { method: "GET" });
  return passthrough(upstream);
}

export async function POST(req: NextRequest) {
  // ここは JSON 前提なので json() のままでOK（将来ファイル送るなら text/arrayBuffer に変更）
  const json = await req.json();

  const upstream = await djFetch(req, "/api/shrines/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });

  return passthrough(upstream);
}
