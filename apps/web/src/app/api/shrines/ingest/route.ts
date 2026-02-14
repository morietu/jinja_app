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
    if (hopByHop.has(key.toLowerCase())) return;
    if (key.toLowerCase() === "set-cookie") {
      res.headers.append("set-cookie", value);
      return;
    }
    res.headers.set(key, value);
  });

  if (!res.headers.get("content-type")) res.headers.set("content-type", "application/json");
  return res;
}

export async function POST(req: NextRequest) {
  const json = await req.json();
  const upstream = await djFetch(req, "/api/shrines/ingest/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });
  return passthrough(upstream);
}
