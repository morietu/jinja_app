// apps/web/src/lib/api/placeCaches.ts
// 互換: 旧名を残す（中身は shrine 検索に委譲）
export { fetchShrines as fetchPlaceCaches, fetchShrineSuggest as fetchPlaceCacheSuggest } from "./shrinesSearch";

// 型を外部で参照してるならここも互換で残す
export type { ShrineListResponse } from "./shrinesSearch";
