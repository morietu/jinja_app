// apps/web/src/app/api/me/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { bffFetchWithAuthFromReq } from "@/lib/server/bffFetch";

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

export async function GET(req: NextRequest) {
  const upstream = await bffFetchWithAuthFromReq(req, "/api/users/me/", {
    method: "GET",
    headers: { Accept: "application/json" },
    // retryOn401/setAccessCookie はデフォルト true だけど明示してもOK
    // opts は第4引数なのでここじゃなく呼び出し側で渡す設計ならそのまま
  });

  // 未ログインは 200 / user:null で返す（現行仕様維持）
  if (upstream.status === 401 || upstream.status === 403) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  // バックエンド不調でも 200 / user:null（現行仕様維持）
  if (!upstream.ok) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const text = await upstream.text().catch(() => "");
  try {
    const data = JSON.parse(text);
    return NextResponse.json({ user: enrich(data) }, { status: 200 });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
