// apps/web/src/app/api/me/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN ||
  process.env.BACKEND_ORIGIN ||
  "http://127.0.0.1:8000";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 共通：プロフィールに仮の拡張フィールドを付与
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
  let access = store.get("access_token")?.value;

  // access 無ければ refresh で再発行
  if (!access) {
    const refresh = store.get("refresh_token")?.value;
    if (!refresh) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const djRefresh = await fetch(`${BACKEND}/api/auth/jwt/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
      cache: "no-store",
    });

    if (!djRefresh.ok) {
      const res = new NextResponse("Unauthorized", { status: 401 });
      res.cookies.set("access_token", "", { path: "/", maxAge: 0 });
      res.cookies.set("refresh_token", "", { path: "/", maxAge: 0 });
      return res;
    }

    const json = (await djRefresh.json()) as { access: string };
    access = json.access;
  }

  // access で me を取得
  const me = await fetch(`${BACKEND}/api/users/me/`, {
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    cache: "no-store",
  });

  // 401 は一度だけ refresh 再トライ
  if (me.status === 401) {
    const refresh = (await cookies()).get("refresh_token")?.value;
    if (!refresh) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const djRefresh2 = await fetch(`${BACKEND}/api/auth/jwt/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
      cache: "no-store",
    });
    if (!djRefresh2.ok) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const { access: newAccess } = (await djRefresh2.json()) as { access: string };

    const me2 = await fetch(`${BACKEND}/api/users/me/`, {
      headers: { Authorization: `Bearer ${newAccess}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!me2.ok) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const data2 = await me2.json();
    const enriched2 = enrich(data2);

    const res = NextResponse.json(enriched2, { headers: { "Cache-Control": "no-store" } });
    res.cookies.set("access_token", newAccess, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60, // 1h
      secure: false,   // dev は http
    });
    return res;
  }

  if (!me.ok) {
    const text = await me.text().catch(() => "");
    return NextResponse.json(
      { ok: false, error: text },
      { status: me.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 通常成功
  const data = await me.json();
  const enriched = enrich(data);
  return NextResponse.json(enriched, { headers: { "Cache-Control": "no-store" } });
}
