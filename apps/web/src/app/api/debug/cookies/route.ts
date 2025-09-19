// apps/web/src/app/api/debug/cookies/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const access = req.cookies.get("access_token")?.value ?? null;
  const refresh = req.cookies.get("refresh_token")?.value ?? null;
  const auth = req.headers.get("authorization");

  return NextResponse.json({
    saw_access_cookie: !!access,
    access_len: access?.length ?? 0,
    saw_refresh_cookie: !!refresh,
    refresh_len: refresh?.length ?? 0,
    // プロキシは「上流へ送る時」に Authorization を付与するので、
    // この /api/debug/cookies では基本 null のままでOK
    authorization_header: auth ?? null,
  });
}
