// apps/web/src/app/api/places/search/route.ts
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    results: [
      { place_id: "p1", name: "明治神宮", formatted_address: "渋谷区…" },
      { place_id: "p2", name: "神田明神", formatted_address: "千代田区…" },
    ],
  });
}
