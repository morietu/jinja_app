// apps/web/src/app/api/users/me/icon/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const incoming = await req.formData();
    const outgoing = new FormData();
    incoming.forEach((value, key) => {
      outgoing.append(key, value as any);
    });

    const upstream = await djFetch(req, "/api/users/me/icon/", {
      method: "POST",
      body: outgoing,
      headers: {
        Accept: "application/json",
      },
    });

    const text = await upstream.text();

    console.log("[BFF] /api/users/me/icon upstream status:", upstream.status);
    console.log("[BFF] /api/users/me/icon upstream body snippet:", text.slice(0, 200));

    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (err: unknown) {
    console.error("[BFF] /api/users/me/icon error:", err);
    return NextResponse.json(
      {
        detail: "BFF /api/users/me/icon でエラーが発生しました",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
