// apps/web/src/lib/url.ts
export function toAbsoluteUrl(href: string): string {
  if (!href) return "";
  // すでに絶対URLならそのまま
  if (/^https?:\/\//i.test(href)) return href;

  // ルート始まり（/api/... など）は origin を付ける（CSRのみ）
  if (href.startsWith("/")) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${href}`;
    }
    // SSR時はそのまま返す（<img src> などはクライアントで解決される）
    return href;
  }

  // 相対パスは / を頭に付ける（/img/... など）
  return `/${href}`;
}
