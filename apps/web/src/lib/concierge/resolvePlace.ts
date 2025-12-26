// apps/web/src/lib/concierge/resolvePlace.ts
import { findPlace, searchPlaces } from "@/lib/api/places";

export async function resolvePlaceFromUtterance(text: string) {
  const q = text.trim();

  // ✅ ガード：空文字・空白のみなら find/search を呼ばない
  if (!q) {
    return { kind: "candidates", data: [] } as const;
  }

  try {
    const found = await findPlace({
      input: q,
      language: "ja",
      fields: "place_id,name,formatted_address,geometry",
    });
    return { kind: "found", data: found } as const;
  } catch {
    const res = await searchPlaces({
      q,
      language: "ja",
    });
    return { kind: "candidates", data: res.results ?? [] } as const;
  }
}
