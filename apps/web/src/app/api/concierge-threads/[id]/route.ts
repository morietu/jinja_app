// apps/web/src/app/api/concierge-threads/[id]/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  const r = await djFetch(req, `/api/concierge-threads/${id}/`, {
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
