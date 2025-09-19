// apps/web/src/lib/api/places.ts
import { apiGet, apiPost } from "@/lib/api/http";

/** A: 検索（一覧用） */
export type PlaceSearchParams = {
  q: string;                 // フリーワード
  language?: string;         // 例: 'ja'
  locationbias?: string;     // circle:lat,lng@radius または ipbias 等
  fields?: string;           // 必要なら
  pagetoken?: string;        // ページングしたい時
};

export async function searchPlaces(params: PlaceSearchParams) {
  const usp = new URLSearchParams();
  usp.set("q", params.q);
  if (params.language)     usp.set("language", params.language);
  if (params.locationbias) usp.set("locationbias", params.locationbias);
  if (params.fields)       usp.set("fields", params.fields);
  if (params.pagetoken)    usp.set("pagetoken", params.pagetoken);

  // 末尾スラ大事。/api は http.ts が付与済みなので書かない
  return apiGet<{ results: any[]; status?: string }>(`/places/search/?${usp.toString()}`);
}

/** B: 特定/解決（place_id 直指定 or input+fields） */
export type PlaceFindPayload =
  | { place_id: string; language?: string; fields?: string }
  | { input: string; language?: string; fields?: string; locationbias?: string };

export async function findPlace(payload: PlaceFindPayload) {
  // POST で JSON ボディ（405 を防ぐ）
  return apiPost<any>("/places/find/", payload);
}
