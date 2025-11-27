// apps/web/src/app/api/my/goshuin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  // ① Cookie から access_token を取得
  const access = req.cookies.get("access_token")?.value;

  if (!access) {
    return NextResponse.json({ detail: "認証が必要です" }, { status: 401 });
  }

  try {
    // ② Django の /api/my/goshuin/ に JWT を付けて投げ直す
    const r = await djFetch("/api/my/goshuin/", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access}`,
        Accept: "application/json",
      },
    });

    const text = await r.text();

    if (!r.ok) {
      // 401/403 などはそのまま返す
      try {
        const errJson = JSON.parse(text);
        return NextResponse.json(errJson, { status: r.status });
      } catch {
        return new NextResponse(text || "Failed to fetch my goshuin", {
          status: r.status,
        });
      }
    }

    // ③ 正常系は JSON として返す
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: 200 });
    } catch {
      return NextResponse.json({ detail: "バックエンドから不正なレスポンス形式です" }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ detail: "バックエンドに接続できません" }, { status: 503 });
  }
}
