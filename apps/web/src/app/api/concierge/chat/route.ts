import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  const body = await req.text();

  const doFetch = (withAuth: boolean) =>
    fetch(`${API_BASE}/api/concierge/chat/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(withAuth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
      cache: "no-store",
    });

  let res = await doFetch(true);

  // ✅ ここが重要：無効トークンなら匿名で再試行
  if (res.status === 401 && token) {
    res = await doFetch(false);
  }

  const text = await res.text();
  try {
    return NextResponse.json(JSON.parse(text), { status: res.status });
  } catch {
    return new NextResponse(text || "", {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "text/plain; charset=utf-8" },
    });
  }
}
