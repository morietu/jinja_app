// apps/web/src/lib/api/publicGoshuins.ts
import type { PublicGoshuinItem } from "@/components/shrine/detail/PublicGoshuinSection";

const RAW_WEB_BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_WEB_BASE_URL || "http://localhost:3000";

// 末尾スラッシュを除去して安定化
function normalizeBase(url: string) {
  return url.replace(/\/+$/, "");
}

// Serverでは絶対URL、Clientでは相対URLにする（混線防止）
function buildUrl(shrineId: number) {
  const path = `/api/public/goshuins?limit=12&offset=0&shrine=${shrineId}`;
  const isServer = typeof window === "undefined";

  if (!isServer) return path;

  const base = normalizeBase(RAW_WEB_BASE || "http://localhost:3000");
  return `${base}${path}`;
}

export async function fetchPublicGoshuinsForShrine(shrineId: number): Promise<PublicGoshuinItem[]> {
  const url = buildUrl(shrineId);

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];

    const json: any = await res.json();
    const raw: any[] = Array.isArray(json) ? json : Array.isArray(json?.results) ? json.results : [];

    return raw
      .map((g) => ({
        id: Number(g.id),
        title: g.title ?? null,
        created_at: g.created_at ?? null,
        // Django配列固定でも、念のため揺れ吸収
        image_url: g.image_url ?? g.imageUrl ?? g.image?.url ?? null,
      }))
      .filter((g) => Number.isFinite(g.id));
  } catch {
    return [];
  }
}
