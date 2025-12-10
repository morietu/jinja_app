// apps/web/src/app/api/my/goshuins/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

function extractIdFromUrl(req: NextRequest): string | null {
  const url = new URL(req.url);
  const segments = url.pathname.replace(/\/+$/, "").split("/");
  const last = segments[segments.length - 1] ?? "";
  if (!last || last === "undefined") {
    return null;
  }
  return last;
}

// DELETE /api/my/goshuins/:id → Django /api/my/goshuins/:id/
export async function DELETE(req: NextRequest) {
  const id = extractIdFromUrl(req);

  console.log("[BFF DELETE ENTER] rawUrl =", req.url, "id =", id);

  if (!id) {
    console.error("[BFF DELETE] id could not be resolved");
    return NextResponse.json({ detail: "id is required" }, { status: 400 });
  }

  const upstream = await djFetch(req, `/api/my/goshuins/${id}/`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });

  console.log("[BFF DELETE upstream status]", upstream.status);

  // ★ 204 の場合は body なしでそのまま返す
  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}


// PATCH /api/my/goshuins/:id/ → Django /api/my/goshuins/:id/
export async function PATCH(req: NextRequest) {
  const id = extractIdFromUrl(req);
  const body = await req.text();

  console.log("[BFF PATCH ENTER] rawUrl =", req.url, "id =", id, "body=", body);

  if (!id) {
    console.error("[BFF PATCH] id could not be resolved");
    return NextResponse.json({ detail: "id is required" }, { status: 400 });
  }

  const upstream = await djFetch(req, `/api/my/goshuins/${id}/`, {
    method: "PATCH",
    body,
    headers: {
      "Content-Type": req.headers.get("content-type") ?? "application/json",
      Accept: "application/json",
    },
  });

  console.log("[BFF PATCH upstream status]", upstream.status);

  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}
