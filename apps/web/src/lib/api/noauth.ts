const API_BASE = "/api";

const NOAUTH_PATTERNS: RegExp[] = [
  /^\/places\//,                // /api/places/...
  /^\/shrines\/popular\/?$/,    // /api/shrines/popular/
  /^\/concierge\/plan\/?$/,     // /api/concierge/plan/
  /^\/shrines\/search\/?$/,     // （あるなら）検索API
  /^\/shrines\/\d+\/?$/,        // 詳細（公開なら）
];

export function isNoAuth(url: string) {
  const path = (url || "").split("?")[0];
  return NOAUTH_PATTERNS.some((re) => re.test(path));
}
