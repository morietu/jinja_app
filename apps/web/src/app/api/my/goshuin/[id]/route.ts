// apps/web/src/app/api/my/goshuin/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

type Params = {
  params: {
    id: string;
  };
};

/**
 * DELETE /api/my/goshuin/:id/ → Django /api/my/goshuins/:id/
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = params;

  // 1) Cookie から access_token を抜く
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)access_token=([^;]+)/);
  let authHeader: string | undefined;

  if (m) {
    try {
      authHeader = `Bearer ${decodeURIComponent(m[1])}`;
    } catch {
      authHeader = `Bearer ${m[1]}`;
    }
  }

  console.log("[api/my/goshuin/[id]] cookie:", cookie);
  console.log("[api/my/goshuin/[id]] authHeader:", authHeader ?? "<none>");

  // 2) djFetch で Django に転送（Authorization を明示的に付ける）
  const r = await djFetch(req, `/api/my/goshuins/${id}/`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
  });

  const text = await r.text();

  return new NextResponse(text, {
    status: r.status,
    headers: {
      "Content-Type": r.headers.get("Content-Type") ?? "application/json",
    },
  });
}
