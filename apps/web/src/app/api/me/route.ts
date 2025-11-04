// apps/web/src/app/api/me/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 表示の都合で残しているダミー拡張
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
  let access: string | null = store.get("access_token")?.value ?? null;
  const refresh: string | null = store.get("refresh_token")?.value ?? null;

  // access 無ければ refresh を試す。両方無ければ未ログイン扱いで 200
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
      const j = (await r.json()) as { access: string };
      access = j.access; // ここで string に確定
    } catch {
      return NextResponse.json({ user: null }, { status: 200 });
    }
  }

  try {
    // いま持っている access で me を取得
    const me = await djFetch(`/api/users/me/`, {
      headers: { Authorization: `Bearer ${access!}` },
    });

    // 期限切れなら一度だけ refresh 再挑戦
    if (me.status === 401 && refresh) {
      const r2 = await djFetch(`/api/auth/jwt/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!r2.ok) return NextResponse.json({ user: null }, { status: 200 });

      const j2 = (await r2.json()) as { access: string };
      const access2 = j2.access;

      const me2 = await djFetch(`/api/users/me/`, {
        headers: { Authorization: `Bearer ${access2}` },
      });
      if (!me2.ok) return NextResponse.json({ user: null }, { status: 200 });

      const data2 = await me2.json();
      const res = NextResponse.json({ user: enrich(data2) }, { status: 200 });
      // 新しいトークンをここで保存
      res.cookies.set("access_token", access2, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
        secure: false, // dev
      });
      return res;
    }

    if (!me.ok) return NextResponse.json({ user: null }, { status: 200 });

    const data = await me.json();
    const res = NextResponse.json({ user: enrich(data) }, { status: 200 });

    // 上で refresh 済みなら access は string。差分がある時だけ更新
    const prev = store.get("access_token")?.value ?? null;
    if (access && access !== prev) {
      res.cookies.set("access_token", access, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
        secure: false,
      });
    }
    return res;
  } catch {
    // バックエンドに繋がらない場合でも 200 / user:null
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
