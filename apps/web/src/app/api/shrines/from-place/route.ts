import { NextRequest, NextResponse } from "next/server";
import { bffPostJsonWithAuthFromReq } from "@/lib/bff/fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  console.log("[from-place] incoming", {
    cookieLen: (req.headers.get("cookie") ?? "").length,
    hasRefresh: Boolean(req.cookies.get("refresh_token")?.value),
    hasAccess: Boolean(req.cookies.get("access_token")?.value),
  });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  return bffPostJsonWithAuthFromReq(req, "/api/shrines/from-place/", payload);
}
