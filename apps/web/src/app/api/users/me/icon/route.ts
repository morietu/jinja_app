// apps/web/src/app/api/users/me/icon/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_BASE = "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  try {
    const accessToken = req.cookies.get("access_token")?.value;
    if (!accessToken) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    // 1. フロントから送られた FormData を読む
    const incoming = await req.formData();

    const icon = incoming.get("icon");
    if (!icon || typeof icon === "string") {
      return NextResponse.json({ detail: "icon ファイルがありません" }, { status: 400 });
    }

    // 2. 送信用の FormData を組み直す
    const form = new FormData();
    form.append("icon", icon);

    // 3. Django に転送（Content-Type は fetch に任せる）
    const backendRes = await fetch(`${BACKEND_BASE}/api/users/me/icon/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    });

    const text = await backendRes.text();
    const backendContentType = backendRes.headers.get("content-type") ?? "text/plain";

    return new NextResponse(text, {
      status: backendRes.status,
      headers: {
        "Content-Type": backendContentType,
      },
    });
  } catch (err) {
  
    console.error("[api/users/me/icon] proxy error", err);
    return NextResponse.json({ detail: "proxy error" }, { status: 500 });
  }
}
