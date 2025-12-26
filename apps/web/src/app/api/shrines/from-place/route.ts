// apps/web/src/app/api/shrines/from-place/route.ts
import { NextResponse } from "next/server";
import { djFetchJson } from "@/lib/bff/djFetchJson"; // 既存に合わせて

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const upstream = await djFetchJson(req, "/api/shrines/from-place/", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(upstream.data, { status: upstream.status });
}
