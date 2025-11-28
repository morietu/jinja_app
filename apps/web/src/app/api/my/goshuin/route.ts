// apps/web/src/app/api/my/goshuin/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/my/goshuin/
export async function GET(req: NextRequest) {
  try {
    const r = await djFetch(req, "/api/my/goshuin/", {
      method: "GET",
      headers: { Accept: "application/json" },
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
    console.error("GET /api/my/goshuin/ proxy failed", err);
    return NextResponse.json({ detail: "バックエンドに接続できません" }, { status: 503 });
  }
}

// POST /api/my/goshuin/（アップロード）
export async function POST(req: NextRequest) {
  try {
    const r = await djFetch(req, "/api/my/goshuin/", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "content-type": req.headers.get("content-type") ?? "",
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
    console.error("POST /api/my/goshuin/ proxy failed", err);
    return NextResponse.json({ detail: "バックエンドに接続できません" }, { status: 503 });
  }
}
