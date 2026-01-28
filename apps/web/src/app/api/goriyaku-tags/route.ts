import type { NextRequest } from "next/server";
import { bffFetchWithAuthFromReq } from "@/lib/bff/fetch";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  return bffFetchWithAuthFromReq(req, "/api/goriyaku-tags/", {
    method: "GET",
    headers: { Accept: "application/json" },
  });
}
