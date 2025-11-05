// apps/web/src/app/api/places/search/route.ts
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  if (process.env.PLAYWRIGHT === "1") {
    // テスト用固定レスポンス
    return Response.json({
      results: [
        {
          place_id: "p1",
          name: "明治神宮",
          formatted_address: "東京都渋谷区…",
        },
        {
          place_id: "p2",
          name: "神田明神",
          formatted_address: "東京都千代田区…",
        },
      ],
    });
  }

  // ここで本来の実装（外部APIへfetch等）にフォールバック
  return new Response("Not implemented", { status: 501 });
}
