// apps/web/src/app/api/shrines/[id]/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    id: "s1",
    name: "日枝神社",
    description: "テストダミー詳細",
  });
}
