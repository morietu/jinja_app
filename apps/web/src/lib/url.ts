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

export function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://127.0.0.1:3000"; // ←ここ
}
