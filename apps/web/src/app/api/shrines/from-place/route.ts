// apps/web/src/app/api/shrines/from-place/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export async function POST(req: Request) {
  const h = await headers();

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const upstream = await fetch(`${API_BASE}/api/shrines/from-place/`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      // 認証が必要な場合に備えて、来たヘッダをできるだけ引き継ぐ
      ...(h.get("authorization") ? { Authorization: h.get("authorization") as string } : {}),
      ...(h.get("cookie") ? { cookie: h.get("cookie") as string } : {}),
    },
    body: JSON.stringify(payload),
  });

  const text = await upstream.text().catch(() => "");
  // upstream のステータスはそのまま返す（デバッグしやすい）
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
