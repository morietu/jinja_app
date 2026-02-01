// apps/web/src/app/api/my/goshuins/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { bffFetchWithAuthFromReq } from "@/lib/server/bffFetch";



export const dynamic = "force-dynamic";

function extractIdFromUrl(req: NextRequest): string | null {
  const url = new URL(req.url);
  const segments = url.pathname.replace(/\/+$/, "").split("/");
  const last = segments[segments.length - 1] ?? "";
  if (!last || last === "undefined") return null;
  return last;
}
export async function PATCH(req: NextRequest) {
  const id = extractIdFromUrl(req);
  if (!id) return NextResponse.json({ detail: "id is required" }, { status: 400 });

  const body = await req.text();
  const contentType = req.headers.get("content-type") ?? "application/json";

  return bffFetchWithAuthFromReq(req, `/api/my/goshuins/${id}/`, {
    method: "PATCH",
    headers: { Accept: "application/json", "Content-Type": contentType },
    body,
  });
}




export async function DELETE(req: NextRequest) {
  const id = extractIdFromUrl(req);
  if (!id) return NextResponse.json({ detail: "id is required" }, { status: 400 });

  return bffFetchWithAuthFromReq(req, `/api/my/goshuins/${id}/`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
}
