// apps/web/src/app/api/concierge/thread/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get("tid");
  if (!tid) {
    return NextResponse.json({ error: "tid is required" }, { status: 400 });
  }

  // ✅ backend 側の実エンドポイントに合わせる（threadを返すやつ）
  
  const path = `/api/concierge/thread/?tid=${encodeURIComponent(tid)}`;

  const r = await djFetch(req, path, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const text = await r.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return new NextResponse(JSON.stringify(body), {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
