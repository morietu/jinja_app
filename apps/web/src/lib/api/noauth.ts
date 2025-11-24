// apps/web/src/lib/api/noauth.ts

const NOAUTH_PATTERNS: RegExp[] = [
  /^\/places\//, // /api/places/...
  /^\/populars\/?$/, // ✅ /api/populars/
  /^\/concierge\/plan\/?$/, // /api/concierge/plan/
  /^\/shrines\/search\/?$/, // （あるなら）検索API
  /^\/shrines\/\d+\/?$/, // 詳細（公開なら）
];

export function isNoAuth(url: string) {
  const path = (url || "").split("?")[0];
  return NOAUTH_PATTERNS.some((re) => re.test(path));
}
