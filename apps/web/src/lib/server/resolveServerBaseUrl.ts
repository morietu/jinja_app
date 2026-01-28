// apps/web/src/lib/server/resolveServerBaseUrl.ts
import { headers } from "next/headers";

function normalizeBase(url: string) {
  return url.replace(/\/+$/, "");
}

function toHeadersLike(h: any): { get: (k: string) => string | null } {
  if (!h) return new Headers();
  if (typeof h.get === "function") return h;

  // iterable (entries) -> Headers
  const it = (h as any)[Symbol.iterator];
  if (typeof it === "function") {
    try {
      return new Headers(Array.from(h as Iterable<[string, string]>));
    } catch {
      // headers()/req 情報が取れない環境があるので握りつぶす（fallbackに落とす）
    }
  }

  // plain object -> Headers
  if (typeof h === "object") {
    try {
      const entries: [string, string][] = [];
      for (const [k, v] of Object.entries(h)) {
        if (v == null) continue;
        if (Array.isArray(v)) {
          for (const vv of v) entries.push([k, String(vv)]);
        } else {
          entries.push([k, String(v)]);
        }
      }
      return new Headers(entries);
    } catch {
      // headers()/req 情報が取れない環境があるので握りつぶす（fallbackに落とす）
    }
  }

  return new Headers();
}

export function resolveServerBaseUrl(fallbackPort = 3000): string {
  // 1) 明示設定（テスト/本番/ローカルで最強）
  const envBase =
    process.env.WEB_BASE_URL || process.env.NEXT_PUBLIC_WEB_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || "";
  if (envBase) return normalizeBase(envBase);

  // 2) Vercel（本番）
  if (process.env.VERCEL_URL) {
    return normalizeBase(`https://${process.env.VERCEL_URL}`);
  }

  // 3) headers（プロキシ/リバプロ環境）
  const h0 = toHeadersLike(headers());
  const proto = h0.get("x-forwarded-proto") ?? "http";
  const host = h0.get("x-forwarded-host") ?? h0.get("host");
  if (host) return normalizeBase(`${proto}://${host}`);

  // 4) 最終フォールバック
  const port = Number(process.env.PORT || "") || fallbackPort;
  return `http://localhost:${port}`;
}
