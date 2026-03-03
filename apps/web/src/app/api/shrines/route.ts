// apps/web/src/app/api/shrines/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

function buildUpstreamPath(req: NextRequest, basePath: string) {
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

async function passthrough(upstream: Response) {
  const body = await upstream.arrayBuffer();
  const res = new NextResponse(body, { status: upstream.status });

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
    if (k === "set-cookie") {
      res.headers.append("set-cookie", value);
      return;
    }
    res.headers.set(key, value);
  });

  if (!res.headers.get("content-type")) res.headers.set("content-type", "application/json");
  return res;
}

export async function GET(req: NextRequest) {
  // ✅ Django 側に public 一覧があるならここを /api/public/shrines/ に寄せる
  // まだ無いなら暫定で /api/shrines/ のままでもOK（ただし “public扱い” と決める）
  const upstreamPath = buildUpstreamPath(req, "/api/shrines/");
  const upstream = await djFetch(req, upstreamPath, { method: "GET" });
  return passthrough(upstream);
}

export async function POST() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
