// apps/web/src/app/api/places/find/route.ts
import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

async function forwardToUpstream(body: unknown) {
  const upstream = await fetch(`${API_BASE}/api/places/find/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

// ✅ GETでも叩けるようにする（seed用）
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const input = (searchParams.get("input") ?? "").trim();
    if (!input) {
      return NextResponse.json({ error: "input is required" }, { status: 400 });
    }

    // upstream は POST 前提なので、ここで body を組む
    const body = {
      input,
      // 必要なら拡張（将来のための逃げ道）
      language: searchParams.get("language") ?? undefined,
      region: searchParams.get("region") ?? undefined,
    };

    return await forwardToUpstream(body);
  } catch (e) {
    return NextResponse.json(
      { error: "places/find GET failed", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

// 既存：POST（本命）
export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("[bff places/find] body=", body);
    return await forwardToUpstream(body);
  } catch (e) {
    return NextResponse.json(
      { error: "places/find POST failed", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
