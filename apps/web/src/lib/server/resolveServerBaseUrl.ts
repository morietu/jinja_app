import "server-only";
import { headers } from "next/headers";

function normalizeBase(url: string) {
  return url.replace(/\/+$/, "");
}

export type HeadersLike = { get: (k: string) => string | null };

export function resolveServerBaseUrlFromHeaders(h: HeadersLike, fallbackPort = 3000): string {
  // 1) 明示設定（最優先）
  const envBase = process.env.WEB_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || "";
  if (envBase) return normalizeBase(envBase);

  // 2) 実リクエストの host を優先
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return normalizeBase(`${proto}://${host}`);

  // 3) Vercel 環境変数（headers が取れない時の保険）
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return normalizeBase(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }

  if (process.env.VERCEL_URL) {
    return normalizeBase(`https://${process.env.VERCEL_URL}`);
  }

  // 4) 最終フォールバック
  const port = Number(process.env.PORT || "") || fallbackPort;
  return `http://localhost:${port}`;
}

export async function resolveServerBaseUrl(fallbackPort = 3000): Promise<string> {
  const h = await headers();
  return resolveServerBaseUrlFromHeaders(h, fallbackPort);
}
