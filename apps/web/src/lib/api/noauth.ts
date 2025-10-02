const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/$/, "") + "/api";


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
