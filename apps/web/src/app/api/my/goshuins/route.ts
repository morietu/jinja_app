// apps/web/src/app/api/my/goshuins/route.ts
import { NextRequest } from "next/server";
import { bffFetchWithAuthFromReq } from "@/lib/server/bffFetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  return bffFetchWithAuthFromReq(req, "/api/my/goshuins/", { method: "GET" });
}

export async function POST(req: NextRequest) {
  const incoming = await req.formData();
  const outgoing = new FormData();
  incoming.forEach((v, k) => outgoing.append(k, v as any));

  return bffFetchWithAuthFromReq(req, "/api/my/goshuins/", {
    method: "POST",
    body: outgoing as any,
    headers: { Accept: "application/json" },
  });
}
