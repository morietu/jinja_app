// apps/web/src/lib/api/tags.ts

export type GoriyakuTag = { id: number; name: string };

export async function getGoriyakuTags() {
  const r = await fetch("/api/goriyaku-tags/", { cache: "no-store" });
  if (!r.ok) throw new Error(`tags fetch failed: ${r.status}`);

  const data = await r.json();

  // 1) そのまま配列
  if (Array.isArray(data)) return data as GoriyakuTag[];

  // 2) よくあるラップ: { results: [...] } / { data: [...] } / { tags: [...] }
  const maybe = (data?.results ?? data?.data ?? data?.tags) as unknown;

  if (Array.isArray(maybe)) return maybe as GoriyakuTag[];

  // 3) “upstreamBody が文字列” パターン（BFFが text を突っ込む系）
  if (typeof data?.upstreamBody === "string") {
    try {
      const parsed = JSON.parse(data.upstreamBody);
      if (Array.isArray(parsed)) return parsed as GoriyakuTag[];
      const inner = parsed?.results ?? parsed?.data ?? parsed?.tags;
      if (Array.isArray(inner)) return inner as GoriyakuTag[];
    } catch {
      // noop
    }
  }

  return [];
}
