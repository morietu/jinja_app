// apps/web/src/app/api/shrines/from-place/route.ts
import { NextRequest } from "next/server";
import { bffPostJsonWithAuthFromReq } from "@/lib/bff/fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const payload = await req.json();
  return bffPostJsonWithAuthFromReq(req, "/api/shrines/from-place/", payload);
}
