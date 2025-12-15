// apps/web/src/app/api/my/goshuins/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

// GET /api/my/goshuins/ → Django /api/my/goshuins/
export async function GET(req: NextRequest) {
  try {
    const upstream = await djFetch(req, "/api/my/goshuins/", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const text = await upstream.text();

    console.log("[BFF] /api/my/goshuins/ upstream status:", upstream.status);
    console.log("[BFF] /api/my/goshuins/ upstream body snippet:", text.slice(0, 200));

    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (err: unknown) {
    console.error("[BFF] /api/my/goshuins/ GET error:", err);
    return NextResponse.json(
      {
        detail: "BFF でエラーが発生しました",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

// POST /api/my/goshuins/ → Django /api/my/goshuins/
export async function POST(req: NextRequest) {
  try {
    const incoming = await req.formData();
    const outgoing = new FormData();
    incoming.forEach((value, key) => {
      outgoing.append(key, value as any);
    });

    const upstream = await djFetch(req, "/api/my/goshuins/", {
      method: "POST",
      body: outgoing,
      headers: {
        Accept: "application/json",
      },
    });

    const text = await upstream.text();

    console.log("[BFF] /api/my/goshuins/ POST upstream status:", upstream.status);

    // 👇 上限超過はここを通る
    if (upstream.status === 403) {
      console.warn("[BFF] goshuin limit exceeded?", text.slice(0, 200));
    }

    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (err: unknown) {
    console.error("[BFF] /api/my/goshuins/ POST error:", err);
    return NextResponse.json(
      {
        detail: "BFF でエラーが発生しました",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
