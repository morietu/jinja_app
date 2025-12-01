// apps/web/src/app/api/my/goshuin/[id]/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: { id: string } };

// PATCH: 公開/非公開などの更新
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = params;

  try {
    const r = await djFetch(req, `/api/my/goshuins/${id}/`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "content-type": req.headers.get("content-type") ?? "application/json",
      },
      body: await req.text(),
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
  } catch (err) {
    console.error(`PATCH /api/my/goshuin/${id} proxy failed`, err);
    return NextResponse.json({ detail: "バックエンドに接続できません" }, { status: 503 });
  }
}

// DELETE: 御朱印削除
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = params;

  try {
    const r = await djFetch(req, `/api/my/goshuins/${id}/`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });

    const text = await r.text();
    if (!r.ok) {
      return new NextResponse(text || r.statusText, { status: r.status });
    }

    return new NextResponse(text || "", { status: r.status || 204 });
  } catch (err) {
    console.error(`DELETE /api/my/goshuin/${id} proxy failed`, err);
    return NextResponse.json({ detail: "バックエンドに接続できません" }, { status: 503 });
  }
}
