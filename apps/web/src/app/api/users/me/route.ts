// apps/web/src/app/api/users/me/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Django 開発環境のベースURL（アイコンと同じに揃える）
const BACKEND_BASE = "http://127.0.0.1:8000";

// GET は既存の /api/me の実装をそのまま利用
export { GET } from "../../me/route";

// PATCH: プロフィール更新をそのままDjangoへ中継
export async function PATCH(req: NextRequest) {
  try {
    const accessToken = req.cookies.get("access_token")?.value;
    if (!accessToken) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    // フロントから来たJSONを「文字列のまま」取得
    const bodyText = await req.text();

    const backendRes = await fetch(`${BACKEND_BASE}/api/users/me/`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: bodyText,
    });

    const contentType = backendRes.headers.get("content-type") ?? "";
    const status = backendRes.status;

    if (contentType.includes("application/json")) {
      const json = await backendRes.json().catch(() => null);
      return NextResponse.json(json, { status });
    }

    const text = await backendRes.text().catch(() => "");
    return new NextResponse(text, {
      status,
      headers: { "Content-Type": contentType || "text/plain" },
    });
  } catch (err) {
   
    console.error("[api/users/me] PATCH proxy error", err);
    return NextResponse.json({ detail: "proxy error" }, { status: 500 });
  }
}
