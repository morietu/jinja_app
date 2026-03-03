// apps/web/src/lib/server/resolveServerBaseUrl.ts
import { headers } from "next/headers";

function normalizeBase(url: string) {
  return url.replace(/\/+$/, "");
}

export type HeadersLike = { get: (k: string) => string | null };

export function resolveServerBaseUrlFromHeaders(h: HeadersLike, fallbackPort = 3000): string {
  // 1) 明示設定（テスト/本番/ローカルで最強）
  const envBase = process.env.WEB_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || "";
  if (envBase) return normalizeBase(envBase);

  // 2) Vercel（本番）
  if (process.env.VERCEL_URL) {
    return normalizeBase(`https://${process.env.VERCEL_URL}`);
  }

  // 3) headers（プロキシ/リバプロ環境）
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return normalizeBase(`${proto}://${host}`);

  // 4) 最終フォールバック
  const port = Number(process.env.PORT || "") || fallbackPort;
  return `http://localhost:${port}`;
}

// 旧: resolveServerBaseUrl() を使ってる箇所がまだあるので “asyncで復活”
export async function resolveServerBaseUrl(fallbackPort = 3000): Promise<string> {
  const h = await headers();
  return resolveServerBaseUrlFromHeaders(h, fallbackPort);
}
