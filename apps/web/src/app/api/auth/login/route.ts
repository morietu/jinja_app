import { cookies } from "next/headers";

export async function POST(req: Request) {
  const { username, password } = await req.json();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE!; // 例: http://localhost:8000

  // Django側のトークン発行エンドポイントに合わせてパス調整（/api/token/ or /auth/jwt/create/）
  const r = await fetch(`${apiBase}/api/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!r.ok) return new Response(null, { status: 401 });

  const { access, refresh } = await r.json();
  const jar = await cookies();
  jar.set("access_token", access,  { httpOnly: true, sameSite: "lax", path: "/" });
  jar.set("refresh_token", refresh,{ httpOnly: true, sameSite: "lax", path: "/" });

  return new Response(null, { status: 200 });
}
