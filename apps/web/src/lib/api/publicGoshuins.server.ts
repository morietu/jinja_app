import "server-only";
import type { PublicGoshuinItem } from "@/components/shrine/detail/PublicGoshuinSection";
import { resolveServerBaseUrl } from "@/lib/server/resolveServerBaseUrl";

export async function fetchPublicGoshuinsForShrineServer(shrineId: number): Promise<PublicGoshuinItem[]> {
  const base = await resolveServerBaseUrl();
  const url = `${base}/api/public/goshuins?limit=12&offset=0&shrine=${encodeURIComponent(String(shrineId))}`;

  try {
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      console.error("[publicGoshuins.server] upstream not ok", {
        shrineId,
        url,
        status: res.status,
      });
      return [];
    }

    const json: any = await res.json();
    const raw: any[] = Array.isArray(json) ? json : Array.isArray(json?.results) ? json.results : [];

    console.log("[publicGoshuins.server] fetched", {
      shrineId,
      url,
      count: raw.length,
    });

    return raw
      .map((g) => ({
        id: Number(g.id),
        title: g.title ?? null,
        created_at: g.created_at ?? null,
        image_url:
          g.image_url ??
          g.imageUrl ??
          g.image?.url ??
          g.images?.[0]?.image_url ??
          g.images?.[0]?.imageUrl ??
          g.images?.[0]?.image ??
          g.images?.[0]?.url ??
          null,
      }))
      .filter((g) => Number.isFinite(g.id));
  } catch (e) {
    console.error("[publicGoshuins.server] fetch failed", {
      shrineId,
      url,
      message: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}
