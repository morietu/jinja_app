// apps/web/src/lib/api/publicGoshuins.ts
import type { PublicGoshuinItem } from "@/components/shrine/detail/PublicGoshuinSection";
import { headers } from "next/headers";

function normalizeBase(url: string) {
  return url.replace(/\/+$/, "");
}

async function resolveServerBaseUrl(): Promise<string> {
  // 1) Playwright だけは env を最優先（CI/本番相当で安定させる）
  const pw = process.env.PLAYWRIGHT_BASE_URL;
  if (pw) return normalizeBase(pw);

  // 2) dev は “今アクセスしてる host” を最優先（3000/3001 自動追従）
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const headerBase = host ? normalizeBase(`${proto}://${host}`) : null;

  if (process.env.NODE_ENV !== "production" && headerBase) return headerBase;

  // 3) prod は env 固定（あれば）
  const env = process.env.NEXT_PUBLIC_WEB_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (env) return normalizeBase(env);

  // 4) 最後の保険
  return headerBase ?? "http://localhost:3000";
}

export async function fetchPublicGoshuinsForShrine(shrineId: number): Promise<PublicGoshuinItem[]> {
  const path = `/api/public/goshuins?limit=12&offset=0&shrine=${shrineId}`;
  const isServer = typeof window === "undefined";
  const url = isServer ? `${await resolveServerBaseUrl()}${path}` : path;

  if (process.env.NODE_ENV !== "production") {
    console.log("[publicGoshuins] fetch url =", url);
  }

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[publicGoshuins] non-ok status =", res.status);
      }
      return [];
    }

    const json: any = await res.json();
    const raw: any[] = Array.isArray(json) ? json : Array.isArray(json?.results) ? json.results : [];

    return raw
      .map((g) => ({
        id: Number(g.id),
        title: g.title ?? null,
        created_at: g.created_at ?? null,
        image_url: g.image_url ?? g.imageUrl ?? g.image?.url ?? null,
      }))
      .filter((g) => Number.isFinite(g.id));
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[publicGoshuins] fetch failed =", e instanceof Error ? e.message : String(e));
    }
    return [];
  }
}
