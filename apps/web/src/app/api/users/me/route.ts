// apps/web/src/app/api/users/me/route.ts
import { NextRequest } from "next/server";
import { bffGetWithAuth, bffFetchWithAuth } from "@/lib/bff/fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;



export async function GET() {
  return bffGetWithAuth("/api/users/me/");
}

// PATCH: プロフィール更新をそのままDjangoへ中継
export async function PATCH(req: NextRequest) {
  const bodyText = await req.text();
  return bffFetchWithAuth("/api/users/me/", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: bodyText,
  });
  
}
