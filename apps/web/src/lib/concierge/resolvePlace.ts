// apps/web/src/lib/concierge/resolvePlace.ts
import { findPlace, searchPlaces } from "@/lib/api/places";

export async function resolvePlaceFromUtterance(text: string) {
  // まず B: /places/find/ を input で叩いて “特定” を試みる
  try {
    const found = await findPlace({
      input: text,
      language: "ja",
      fields: "place_id,name,formatted_address,geometry",
    });
    // ここで found に shrine_id などが入っていれば “取り込み/紐付け済み”
    return { kind: "found", data: found } as const;
  } catch (e: any) {
    // 404/422 等で解決不可なら A にフォールバック
    const res = await searchPlaces({
      q: text,
      language: "ja",
    });
    return { kind: "candidates", data: res.results ?? [] } as const;
  }
}
