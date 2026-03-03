// apps/web/src/lib/api/publicGoshuins.server.ts
import "server-only";
import type { PublicGoshuinItem } from "@/components/shrine/detail/PublicGoshuinSection";
import { resolveServerBaseUrl } from "@/lib/server/resolveServerBaseUrl";

export async function fetchPublicGoshuinsForShrineServer(shrineId: number): Promise<PublicGoshuinItem[]> {
  const base = resolveServerBaseUrl();
  const url = `${base}/api/public/goshuins?limit=12&offset=0&shrine=${encodeURIComponent(String(shrineId))}`;

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
        image_url: g.image_url ?? g.imageUrl ?? g.image?.url ?? null,
      }))
      .filter((g) => Number.isFinite(g.id));
  } catch {
    return [];
  }
}
