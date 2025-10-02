// apps/web/src/app/api/auth/refresh/route.ts
import { cookies } from "next/headers";

export async function POST() {
  const jar = await cookies();
  const refresh = jar.get("refresh_token")?.value;
  if (!refresh) return new Response(null, { status: 401 });

  const apiBase = process.env.NEXT_PUBLIC_API_BASE!;
  // SimpleJWTなら /auth/jwt/refresh/、既存仕様なら /api/token/refresh/ に合わせる
  const r = await fetch(`${apiBase}/api/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!r.ok) return new Response(null, { status: 401 });
  const { access } = await r.json();
  jar.set("access_token", access, { httpOnly: true, sameSite: "lax", path: "/" });
  return new Response(null, { status: 200 });
}
