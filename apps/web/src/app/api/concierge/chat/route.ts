import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export async function POST(req: Request) {
  // ✅ Nextのバージョン差を吸収（cookiesがasyncの環境でも動く）
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  const body = await req.text();

  const res = await fetch(`${API_BASE}/api/concierge/chat/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
    cache: "no-store",
  });

  console.log("proxy concierge/chat called", { hasToken: !!token, status: res.status });

  // ✅ 失敗時や非JSONでも落ちないようにする（ここが超重要）
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return new NextResponse(text || "", {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "text/plain; charset=utf-8" },
    });
  }
}
