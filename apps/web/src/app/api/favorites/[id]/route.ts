// apps/web/src/app/api/favorites/[id]/route.ts
import { NextRequest } from "next/server";
import { bffFetchWithAuthFromReq } from "@/lib/bff/fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return bffFetchWithAuthFromReq(req, `/api/favorites/${encodeURIComponent(id)}/`, { method: "DELETE" });
}
