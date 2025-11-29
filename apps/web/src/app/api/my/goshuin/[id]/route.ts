// apps/web/src/app/api/my/goshuin/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: { id: string } };

// GET /api/my/goshuin/:id/ （必要なら）
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = params;

  try {
    const r = await djFetch(req, `/api/my/goshuin/${id}/`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const text = await r.text();

    if (!r.ok) {
      return new NextResponse(text || r.statusText, { status: r.status });
    }

    return new NextResponse(text || "", {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (e) {
    console.error("GET /api/my/goshuin/:id proxy failed", e);
    return NextResponse.json({ detail: "バックエンドに接続できません" }, { status: 503 });
  }
}

// DELETE /api/my/goshuin/:id/
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = params;

  try {
    const r = await djFetch(req, `/api/my/goshuin/${id}/`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    });

    const text = await r.text();

    if (!r.ok) {
      return new NextResponse(text || r.statusText, { status: r.status });
    }

    // Django 側は 204 想定
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error("DELETE /api/my/goshuin/:id proxy failed", e);
    return NextResponse.json({ detail: "バックエンドに接続できません" }, { status: 503 });
  }
}
