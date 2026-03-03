// apps/web/src/app/api/my/shrines/ingest/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

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

export async function POST(req: NextRequest) {
  // upstream は Django 側の ingest を叩く（あなたの環境に合わせて）
  const json = await req.json().catch(() => null);
  if (!json?.place_id) {
    return NextResponse.json({ error: "missing_place_id" }, { status: 400 });
  }

  const upstream = await djFetch(req, "/api/shrines/ingest/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ place_id: json.place_id }),
  });

  return passthrough(upstream);
}
