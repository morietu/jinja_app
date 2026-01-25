import type { PublicGoshuinItem } from "@/components/shrine/detail/PublicGoshuinSection";

export async function fetchPublicGoshuinsForShrine(shrineId: number): Promise<PublicGoshuinItem[]> {
  try {
    const res = await fetch(`/api/public/goshuins?limit=12&offset=0&shrine=${shrineId}`, { cache: "no-store" });
    if (!res.ok) return [];

    const json = (await res.json()) as unknown;
    const raw: any[] = Array.isArray(json) ? json : Array.isArray((json as any)?.results) ? (json as any).results : [];

    return raw
      .map((g) => ({
        id: Number(g.id),
        title: g.title ?? null,
        created_at: g.created_at,
        image_url: g.image_url ?? null,
      }))
      .filter((g) => Number.isFinite(g.id));
  } catch {
    return [];
  }
}
