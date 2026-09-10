import type { NextRequest } from "next/server";

import { bffFetchWithAuthFromReq } from "@/lib/server/bffFetch";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  return bffFetchWithAuthFromReq(req, `/api/shrines/${encodeURIComponent(id)}/meaning/`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
}
