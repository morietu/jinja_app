// apps/web/src/app/api/places/resolve/route.ts
import type { NextRequest } from "next/server";
import { bffPostJsonWithAuthFromReq } from "@/lib/server/bff";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  return bffPostJsonWithAuthFromReq(req, "/api/places/resolve/", payload);
}
