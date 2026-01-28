import type { NextRequest } from "next/server";
import { bffFetchWithAuthFromReq } from "@/lib/bff/fetch";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  return bffFetchWithAuthFromReq(req, `/api/concierge-threads/${id}/`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
}
