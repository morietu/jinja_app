import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { bffFetchWithAuthFromReq } from "@/lib/bff/fetch";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get("tid");
  if (!tid) return NextResponse.json({ error: "tid is required" }, { status: 400 });

  const path = `/api/concierge/thread/?tid=${encodeURIComponent(tid)}`;

  return bffFetchWithAuthFromReq(req, path, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
}
