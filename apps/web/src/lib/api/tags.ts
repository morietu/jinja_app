// apps/web/src/lib/api/tags.ts
import api from "./client";

export type GoriyakuTag = { id: number; name: string };

export async function getGoriyakuTags() {
  const r = await fetch("/api/goriyaku-tags/", { cache: "no-store" });
  if (!r.ok) throw new Error(`tags fetch failed: ${r.status}`);
  const data = await r.json();
  return Array.isArray(data) ? (data as GoriyakuTag[]) : [];
}
