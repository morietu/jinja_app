// 未使用なら削除（将来使うなら export して利用箇所で参照）

const NOAUTH_PATTERNS: RegExp[] = [
  /^\/places\//, // /api/places/...
  /^\/shrines\/popular\/?$/, // /api/shrines/popular/
  /^\/concierge\/plan\/?$/, // /api/concierge/plan/
  /^\/shrines\/search\/?$/, // （あるなら）検索API
  /^\/shrines\/\d+\/?$/, // 詳細（公開なら）
];

export function isNoAuth(url: string) {
  const path = (url || "").split("?")[0];
  return NOAUTH_PATTERNS.some((re) => re.test(path));
}
