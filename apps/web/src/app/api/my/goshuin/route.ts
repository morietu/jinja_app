// apps/web/src/app/api/my/goshuin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

/**
 * GET /api/my/goshuin/ → Django /api/my/goshuins/
 */
export async function GET(req: NextRequest) {
  const r = await djFetch(req, "/api/my/goshuins/", {
    method: "GET",
    headers: {
      Accept: "application/json",
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

/**
 * POST /api/my/goshuin/ → Django /api/my/goshuins/
 * body はそのままストリームで渡す（Content-Type は djFetch に任せる）
 */
export async function POST(req: NextRequest) {
  // 1) ブラウザから来た multipart を FormData で読み出す
  const incoming = await req.formData();

  // 2) 新しい FormData に詰め直す（そのままコピー）
  const outgoing = new FormData();
  incoming.forEach((value, key) => {
    outgoing.append(key, value as any);
  });

  // 3) djFetch で Django に投げる（Content-Type は書かない）
  const r = await djFetch(req, "/api/my/goshuins/", {
    method: "POST",
    body: outgoing,
    headers: {
      Accept: "application/json",
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
