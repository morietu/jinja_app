// apps/web/src/lib/api/tags.ts
import api from "./client";

export type GoriyakuTag = { id: number; name: string };

export async function getGoriyakuTags() {
  const res = await api.get("/api/goriyaku-tags/");
  return res.data as GoriyakuTag[];
}
