// apps/web/src/app/api/me/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 表示用に軽く拡張（ダミー値）
function enrich(data: any) {
  return {
    ...data,
    profile: {
      ...(data.profile ?? {}),
      birthday: data.profile?.birthday ?? "1990-04-10",
      location: data.profile?.location ?? "Tokyo",
    },
  };
}

export async function GET() {
  const store = await cookies();
  let access = store.get("access_token")?.value || null;
  const refresh = store.get("refresh_token")?.value || null;

  // access が無ければ refresh 試行、両方無ければ未ログイン
  if (!access) {
    if (!refresh) return NextResponse.json({ user: null }, { status: 200 });

    try {
      const r = await djFetch(`/api/auth/jwt/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!r.ok) {
        const res = NextResponse.json({ user: null }, { status: 200 });
        res.cookies.delete("access_token");
        res.cookies.delete("refresh_token");
        return res;
      }
      const j = await r.json();
      access = j.access;
      // 新しい access を保存（任意）
      const res = NextResponse.next();
      res.cookies.set("access_token", access, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60, // 1h
        secure: false, // dev は http
      });
    } catch {
      // バックエンド死んでても未ログインで返す
      return NextResponse.json({ user: null }, { status: 200 });
    }
  }

  // /users/me を取得
  try {
    const me = await djFetch(`/api/users/me/`, {
      headers: { Authorization: `Bearer ${access}` },
    });

    // access 期限切れ → refresh で 1 回だけ再挑戦
    if (me.status === 401 && refresh) {
      const r2 = await djFetch(`/api/auth/jwt/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!r2.ok) return NextResponse.json({ user: null }, { status: 200 });

      const j2 = await r2.json();
      const access2 = j2.access;

      const me2 = await djFetch(`/api/users/me/`, {
        headers: { Authorization: `Bearer ${access2}` },
      });
      if (!me2.ok) return NextResponse.json({ user: null }, { status: 200 });

      const data2 = await me2.json();
      const res = NextResponse.json({ user: enrich(data2) }, { status: 200 });
      res.cookies.set("access_token", access2, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
        secure: false,
      });
      return res;
    }

    if (!me.ok) {
      // その他のエラーは未ログイン扱い
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const data = await me.json();
    return NextResponse.json({ user: enrich(data) }, { status: 200 });
  } catch {
    // 接続失敗時もフロントは動かす
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
